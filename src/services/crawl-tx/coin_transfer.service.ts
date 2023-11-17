import { ServiceBroker } from 'moleculer';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import {
  BlockCheckpoint,
  CoinTransfer,
  Event,
  Transaction,
} from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CoinTransfer.key,
  version: 1,
})
export default class CoinTransferService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description Get transaction data for insert coin transfer
   * @param fromHeight
   * @param toHeight
   * @private
   */
  private async fetchTransactionCTByHeight(
    fromHeight: number,
    toHeight: number
  ): Promise<Transaction[]> {
    const transactions = await Transaction.query()
      .withGraphFetched('messages')
      .where('height', '>', fromHeight)
      .andWhere('height', '<=', toHeight);
    if (transactions.length === 0) return [];

    const transactionsWithId: any = [];
    transactions.forEach((transaction) => {
      transactionsWithId[transaction.id] = {
        ...transaction,
        events: [],
      };
    });

    const minTransactionId = transactions[0].id;
    const maxTransactionId = transactions[transactions.length - 1].id;
    const events = await Event.query()
      .withGraphFetched('attributes')
      .where('tx_id', '>=', minTransactionId)
      .andWhere('tx_id', '<=', maxTransactionId)
      .whereNotNull('tx_msg_index');
    events.forEach((event) => {
      transactionsWithId[event.tx_id].events.push(event);
    });

    return transactionsWithId;
  }

  /**
   * split amount to amount and denom using regex
   * example: 10000uaura
   * amount = 10000
   * denom = uaura
   * return [0, ''] if invalid
   */
  private extractAmount(rawAmount: string | undefined): [number, string] {
    const amount = rawAmount?.match(/(\d+)/)?.[0] ?? '0';
    const denom = rawAmount?.replace(amount, '') ?? '';
    return [Number.parseInt(amount, 10), denom];
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_COIN_TRANSFER,
    jobName: BULL_JOB_NAME.HANDLE_COIN_TRANSFER,
  })
  public async jobHandleTxCoinTransfer() {
    const [fromBlock, toBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_COIN_TRANSFER,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        'handleCoinTransfer'
      );

    if (fromBlock >= toBlock) {
      this.logger.info('Waiting for new transaction crawled');
      return;
    }

    this.logger.info(`QUERY FROM ${fromBlock} - TO ${toBlock}................`);

    const coinTransfers: CoinTransfer[] = [];
    const transactions = await this.fetchTransactionCTByHeight(
      fromBlock,
      toBlock
    );

    transactions.forEach((tx: Transaction) => {
      tx.events.forEach((event: Event) => {
        if (!event.tx_msg_index) return;
        // skip if message is not 'MsgMultiSend'
        if (
          event.attributes.length !== 3 &&
          tx.messages[event.tx_msg_index].type !==
            '/cosmos.bank.v1beta1.MsgMultiSend'
        ) {
          this.logger.error(
            'Coin transfer detected in unsupported message type',
            tx.hash,
            tx.messages[event.tx_msg_index].content
          );
          return;
        }

        const ctTemplate = {
          block_height: tx.height,
          tx_id: tx.id,
          tx_msg_id: tx.messages[event.tx_msg_index].id,
          from: event.attributes.find((attr) => attr.key === 'sender')?.value,
          to: '',
          amount: 0,
          denom: '',
          timestamp: new Date(tx.timestamp).toISOString(),
        };
        /**
         * we expect 2 cases:
         * 1. transfer event has only 1 sender and 1 recipient
         *    then the event will have 3 attributes: sender, recipient, amount
         * 2. transfer event has 1 sender and multiple recipients, message must be 'MsgMultiSend'
         *    then the event will be an array of attributes: recipient1, amount1, recipient2, amount2, ...
         *    sender is the coin_spent.spender
         */
        if (event.attributes.length === 3) {
          const rawAmount = event.attributes.find(
            (attr) => attr.key === 'amount'
          )?.value;
          const [amount, denom] = this.extractAmount(rawAmount);
          coinTransfers.push(
            CoinTransfer.fromJson({
              ...ctTemplate,
              from: event.attributes.find((attr) => attr.key === 'sender')
                ?.value,
              to: event.attributes.find((attr) => attr.key === 'recipient')
                ?.value,
              amount,
              denom,
            })
          );
          return;
        }

        const coinSpentEvent = tx.events.find(
          (e: Event) =>
            e.type === 'coin_spent' && e.tx_msg_index === event.tx_msg_index
        );
        ctTemplate.from = coinSpentEvent?.attributes.find(
          (attr: { key: string; value: string }) => attr.key === 'spender'
        )?.value;
        for (let i = 0; i < event.attributes.length; i += 2) {
          if (
            event.attributes[i].key !== 'recipient' &&
            event.attributes[i + 1].key !== 'amount'
          ) {
            this.logger.error(
              'Coin transfer in MsgMultiSend detected with invalid attributes',
              tx.hash,
              event.attributes
            );
            return;
          }

          const rawAmount = event.attributes[i + 1].value;
          const [amount, denom] = this.extractAmount(rawAmount);
          coinTransfers.push(
            CoinTransfer.fromJson({
              ...ctTemplate,
              to: event.attributes[i].value,
              amount,
              denom,
            })
          );
        }
      });
    });

    updateBlockCheckpoint.height = toBlock;
    await knex.transaction(async (trx) => {
      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge();

      if (coinTransfers.length > 0) {
        this.logger.info(`INSERTING ${coinTransfers.length} COIN TRANSFER`);
        await CoinTransfer.query().transacting(trx).insert(coinTransfers);
      }
    });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.HANDLE_COIN_TRANSFER,
      BULL_JOB_NAME.HANDLE_COIN_TRANSFER,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleCoinTransfer.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

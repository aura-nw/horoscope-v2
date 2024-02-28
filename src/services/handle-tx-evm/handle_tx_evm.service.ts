import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import {
  BlockCheckpoint,
  EVMTransaction,
  TransactionMessage,
} from '../../models';
import { BULL_JOB_NAME, MSG_TYPE, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.HandleTransactionEVM.key,
  version: 1,
})
export default class HandleTransactionEVMService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_TRANSACTION_EVM,
    jobName: BULL_JOB_NAME.HANDLE_TRANSACTION_EVM,
  })
  async jobHandler() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_TRANSACTION_EVM,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.handleTransactionEVM.key
      );
    this.logger.info(
      `Handle EVM transaction from block ${startBlock} to block ${endBlock}`
    );
    if (startBlock >= endBlock) {
      return;
    }
    const evmTxs: EVMTransaction[] = [];

    const txMsgs = await TransactionMessage.query()
      .joinRelated('transaction')
      .select(
        'transaction_message.id as tx_msg_id',
        'transaction.id as tx_id',
        'transaction.height',
        'transaction_message.sender',
        'transaction_message.content'
      )
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock)
      .andWhere('type', MSG_TYPE.MSG_ETHEREUM_TX)
      .orderBy('height', 'asc');
    if (txMsgs.length > 0) {
      txMsgs.forEach((txMsg) => {
        const { content } = txMsg;
        evmTxs.push(
          EVMTransaction.fromJson({
            height: txMsg.height,
            tx_id: txMsg.tx_id,
            tx_msg_id: txMsg.tx_msg_id,
            hash: content.hash,
            size: content.size,
            from: content.from,
            to: content.data?.to,
            gas: BigInt(content.data?.gas ?? 0),
            gas_fee_cap: BigInt(content.data?.gas_fee_cap ?? 0),
            gas_tip_cap: BigInt(content.data?.gas_tip_cap ?? 0),
            data: content.data?.data,
            nonce: BigInt(content.data?.nonce ?? 0),
            value: BigInt(content.data?.value ?? 0),
          })
        );
      });
    }

    await knex.transaction(async (trx) => {
      if (evmTxs.length > 0) {
        await trx
          .batchInsert(
            EVMTransaction.tableName,
            evmTxs,
            config.handleTransactionEVM.chunkSize
          )
          .transacting(trx);
      }
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;

        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      }
    });
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.HANDLE_TRANSACTION_EVM,
      BULL_JOB_NAME.HANDLE_TRANSACTION_EVM,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleTransactionEVM.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

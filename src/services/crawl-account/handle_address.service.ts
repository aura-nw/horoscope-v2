import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Utils from 'src/common/utils/utils';
import {
  CONST_CHAR,
  BULL_JOB_NAME,
  SERVICE_NAME,
  BULL_ACTION_NAME,
} from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import BlockCheckpoint from '../../models/block_checkpoint';
import Block from '../../models/block';
import Transaction from '../../models/transaction';
import TransactionEvent from '../../models/transaction_event';
import TransactionEventAttribute from '../../models/transaction_event_attribute';
import { Account } from '../../models/account';

@Service({
  name: SERVICE_NAME.HANDLE_ADDRESS,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class HandleAddressService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ADDRESS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJob(_payload: object): Promise<void> {
    const listInsert: any[] = [];

    const [handleAddressBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('height')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_ADDRESS),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let lastHeight = 0;
    if (handleAddressBlockCheckpoint)
      lastHeight = handleAddressBlockCheckpoint.height;

    if (latestBlock) {
      const eventAddresses: string[] = [];
      let offset = 0;
      let done = false;
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .select('id', 'height')
          .where('height', '>', lastHeight)
          .andWhere('height', '<=', latestBlock.height)
          .limit(100)
          .offset(offset)
          .join(
            TransactionEvent.query()
              .select('tx_id')
              .join(
                TransactionEventAttribute.query()
                  .select('*')
                  .where('key', '=', `${btoa(CONST_CHAR.RECEIVER)}`)
                  .orWhere('key', '=', `${btoa(CONST_CHAR.SPENDER)}`)
                  .orWhere('key', '=', `${btoa(CONST_CHAR.SENDER)}`),
                function () {
                  this.on(
                    'transaction_event.id',
                    '=',
                    'transaction_event_attribute.event_id'
                  );
                }
              ),
            function () {
              this.on('transaction.id', '=', 'transaction_event.tx_id');
            }
          );
        this.logger.info(
          `Result get Tx from height ${lastHeight} to ${
            latestBlock.height
          }: ${JSON.stringify(resultTx)}`
        );

        if (resultTx.length > 0)
          resultTx.map((res: any) => eventAddresses.push(atob(res.value)));

        if (resultTx.length === 100) offset += 1;
        else done = true;
      }

      const listAddresses = eventAddresses
        .filter((addr: string) => Utils.isValidAddress(addr, 20))
        .filter(Utils._onlyUnique);

      if (listAddresses.length > 0) {
        const existedAccounts: string[] = (
          await Account.query().select('*').whereIn('address', listAddresses)
        ).map((account: Account) => account.address);

        listAddresses.forEach((address: string) => {
          if (!existedAccounts.includes(address)) {
            const account: Account = Account.fromJson({
              address,
              balances: null,
              spendable_balances: null,
              type: null,
              pubkey: null,
              account_number: null,
              sequence: null,
            });
            listInsert.push(Account.query().insert(account));
          }
        });

        try {
          await Promise.all([
            ...listInsert,
            BlockCheckpoint.query()
              .insert(
                BlockCheckpoint.fromJson({
                  job_name: BULL_JOB_NAME.HANDLE_ADDRESS,
                  height: latestBlock.height,
                })
              )
              .onConflict('job_name')
              .merge()
              .returning('id'),
          ]);
        } catch (error) {
          this.logger.error(error);
        }

        this.broker.call(
          `${CONST_CHAR.VERSION}.${SERVICE_NAME.CRAWL_ACCOUNT}.${BULL_ACTION_NAME.ACCOUNT_UPSERT}`,
          { listAddresses }
        );
      }
    }
  }
}

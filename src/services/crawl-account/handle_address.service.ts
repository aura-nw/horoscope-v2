import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import {
  Account,
  Block,
  BlockCheckpoint,
  TransactionEventAttribute,
} from '../../models';
import Utils from '../../common/utils/utils';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  IListAddressesParam,
  SERVICE,
  SERVICE_NAME,
} from '../../common';
import config from '../../../config.json';

@Service({
  name: SERVICE_NAME.HANDLE_ADDRESS,
  version: 1,
})
export default class HandleAddressService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.HandleAddress.CrawlNewAccountApi.key,
    params: {
      listAddresses: 'string[]',
    },
  })
  public async actionCrawlNewAccountApi(ctx: Context<IListAddressesParam>) {
    await this.insertNewAccount(ctx.params.listAddresses);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ADDRESS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const [handleAddressBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_ADDRESS),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);
    this.logger.info(
      `Block Checkpoint: ${JSON.stringify(handleAddressBlockCheckpoint)}`
    );

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (handleAddressBlockCheckpoint) {
      lastHeight = handleAddressBlockCheckpoint.height;
      updateBlockCheckpoint = handleAddressBlockCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_ADDRESS,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === lastHeight) return;

      const eventAddresses: string[] = [];
      let offset = 0;
      let done = false;
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await TransactionEventAttribute.query()
          .joinRelated('event.[transaction]')
          .whereIn('transaction_event_attribute.key', [
            TransactionEventAttribute.EVENT_KEY.RECEIVER,
            TransactionEventAttribute.EVENT_KEY.SPENDER,
            TransactionEventAttribute.EVENT_KEY.SENDER,
          ])
          .andWhere('event:transaction.height', '>', lastHeight)
          .andWhere('event:transaction.height', '<=', latestBlock.height)
          .select(
            'event:transaction.id',
            'event:transaction.height',
            'transaction_event_attribute.key',
            'transaction_event_attribute.value'
          )
          .page(offset, 100);
        this.logger.info(
          `Query Tx from height ${lastHeight} to ${
            latestBlock.height
          } at page ${offset + 1}`
        );

        if (resultTx.results.length > 0)
          resultTx.results.map((res: any) => eventAddresses.push(res.value));

        if (resultTx.results.length === 100) offset += 1;
        else done = true;
      }

      const listAddresses = Array.from(
        new Set(
          eventAddresses.filter((addr: string) =>
            Utils.isValidAccountAddress(addr, config.networkPrefixAddress, 20)
          )
        )
      );

      if (listAddresses.length > 0) {
        await this.insertNewAccount(listAddresses);

        this.broker.call(SERVICE.V1.CrawlAccount.UpdateAccount.path, {
          listAddresses: Array.from(listAddresses),
        });

        updateBlockCheckpoint.height = latestBlock.height;
        await BlockCheckpoint.query()
          .insert(updateBlockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id');
      }
    }
  }

  private async insertNewAccount(listAddresses: string[]) {
    const listAccounts: Account[] = [];

    const existedAccounts: string[] = (
      await Account.query().select('*').whereIn('address', listAddresses)
    ).map((account: Account) => account.address);

    listAddresses.forEach((address: string) => {
      if (!existedAccounts.includes(address)) {
        const account: Account = Account.fromJson({
          address,
          balances: [],
          spendable_balances: [],
          type: null,
          pubkey: {},
          account_number: 0,
          sequence: 0,
        });
        listAccounts.push(account);
      }
    });

    try {
      await Account.query().insert(listAccounts);
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async _start() {
    await this.broker.waitForServices([SERVICE.V1.CrawlAccount.name]);

    this.createJob(
      BULL_JOB_NAME.HANDLE_ADDRESS,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleAddress.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}

import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import {
  Account,
  Block,
  BlockCheckpoint,
  Transaction,
  TransactionEventAttribute,
} from '../../models';
import Utils from '../../common/utils/utils';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  IAddressesParam,
  MSG_TYPE,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.HandleAddressService.key,
  version: 1,
})
export default class HandleAddressService extends BullableService {
  private msgStakes = [
    MSG_TYPE.MSG_DELEGATE,
    MSG_TYPE.MSG_REDELEGATE,
    MSG_TYPE.MSG_UNDELEGATE,
  ];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.HandleAddressService.CrawlNewAccountApi.key,
    params: {
      listAddresses: 'string[]',
    },
  })
  public async actionCrawlNewAccountApi(ctx: Context<IAddressesParam>) {
    await this.insertNewAccountAndUpdate(ctx.params.addresses);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ADDRESS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const stakeTxs: any[] = [];

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
      this.logger.info(
        `Start query Tx from height ${lastHeight} to ${latestBlock.height}`
      );
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .joinRelated('[messages, events.[attributes]]')
          .whereIn('events:attributes.key', [
            TransactionEventAttribute.EVENT_KEY.RECEIVER,
            TransactionEventAttribute.EVENT_KEY.SPENDER,
            TransactionEventAttribute.EVENT_KEY.SENDER,
          ])
          .andWhere('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .select(
            'transaction.id',
            'transaction.height',
            'transaction.timestamp',
            'messages.id as tx_msg_id',
            'messages.type',
            'events:attributes.key',
            'events:attributes.value'
          )
          .page(offset, 100);
        this.logger.info(
          `Query Tx from height ${lastHeight} to ${
            latestBlock.height
          } at page ${offset + 1}`
        );

        if (resultTx.results.length > 0) {
          resultTx.results.map((res: any) => eventAddresses.push(res.value));

          stakeTxs.push(
            ...resultTx.results.filter((res: any) =>
              this.msgStakes.includes(res.type)
            )
          );
        }

        if (resultTx.results.length === 100) offset += 1;
        else done = true;
      }

      const addresses = Array.from(
        new Set(
          eventAddresses.filter((addr: string) =>
            Utils.isValidAccountAddress(addr, config.networkPrefixAddress, 20)
          )
        )
      );

      if (addresses.length > 0) await this.insertNewAccountAndUpdate(addresses);

      if (stakeTxs && stakeTxs.length > 0)
        await this.handlePowerEvent(stakeTxs);

      updateBlockCheckpoint.height = latestBlock.height;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
    }
  }

  private async insertNewAccountAndUpdate(addresses: string[]) {
    const accounts: Account[] = [];

    const existedAccounts: string[] = (
      await Account.query().select('*').whereIn('address', addresses)
    ).map((account: Account) => account.address);

    addresses.forEach((address: string) => {
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
        accounts.push(account);
      }
    });

    if (accounts.length > 0) await Account.query().insert(accounts);

    await this.broker.call(SERVICE.V1.CrawlAccountService.UpdateAccount.path, {
      addresses,
    });
  }

  private async handlePowerEvent(stakeTxs: any[]) {
    const txMsgIds = Array.from(
      new Set(stakeTxs.map((txStake) => txStake.tx_msg_id))
    );

    await this.broker.call(
      SERVICE.V1.HandleStakeEventService.UpdatePowerEvent.path,
      {
        listTxMsgIds: txMsgIds,
      }
    );
  }

  public async _start() {
    await this.broker.waitForServices([
      SERVICE.V1.CrawlAccountService.name,
      SERVICE.V1.HandleStakeEventService.name,
    ]);

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

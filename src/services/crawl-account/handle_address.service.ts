import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { Account, Block, BlockCheckpoint, EventAttribute } from '../../models';
import Utils from '../../common/utils/utils';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, Config, IAddressesParam, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.HandleAddressService.key,
  version: 1,
})
export default class HandleAddressService extends BullableService {
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
    const [handleAddrCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_ADDRESS),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);
    this.logger.info(
      `Block Checkpoint: ${JSON.stringify(handleAddrCheckpoint)}`
    );

    let startHeight = 0;
    let endHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (handleAddrCheckpoint) {
      startHeight = handleAddrCheckpoint.height;
      updateBlockCheckpoint = handleAddrCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_ADDRESS,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === startHeight) return;
      endHeight = Math.min(
        startHeight + config.handleAddress.blocksPerCall,
        latestBlock.height - 1
      );

      const eventAddresses: string[] = [];
      this.logger.info(`Query Tx from height ${startHeight} to ${endHeight}`);
      const resultTx = await EventAttribute.query()
        .whereIn('key', [
          EventAttribute.ATTRIBUTE_KEY.RECEIVER,
          EventAttribute.ATTRIBUTE_KEY.SPENDER,
          EventAttribute.ATTRIBUTE_KEY.SENDER,
        ])
        .andWhere('block_height', '>', startHeight)
        .andWhere('block_height', '<=', endHeight)
        .select('value');

      if (resultTx.length > 0)
        resultTx.map((res: any) => eventAddresses.push(res.value));

      const addresses = Array.from(
        new Set(
          eventAddresses.filter((addr: string) =>
            Utils.isValidAccountAddress(addr, config.networkPrefixAddress, 20)
          )
        )
      );

      if (addresses.length > 0) await this.insertNewAccountAndUpdate(addresses);

      updateBlockCheckpoint.height = endHeight;
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

  public async _start() {
    await this.broker.waitForServices(SERVICE.V1.CrawlAccountService.name);

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

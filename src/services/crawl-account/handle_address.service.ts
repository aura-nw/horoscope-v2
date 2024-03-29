import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import { Context, ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, IAddressesParam, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import Utils from '../../common/utils/utils';
import { Account, BlockCheckpoint } from '../../models';
import { convertBech32AddressToEthAddress } from '../evm/utils';

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
      addresses: 'string[]',
    },
  })
  public async actionCrawlNewAccountApi(ctx: Context<IAddressesParam>) {
    await knex.transaction(async (trx) =>
      this.insertNewAccountAndUpdate(ctx.params.addresses, trx)
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ADDRESS,
    jobName: BULL_JOB_NAME.HANDLE_ADDRESS,
    // prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_ADDRESS,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.handleAddress.key
      );
    this.logger.info(`startHeight: ${startHeight}, endHeight: ${endHeight}`);
    if (startHeight >= endHeight) return;

    const eventAddresses: string[] = [];
    const resultTx = await knex.raw(
      'SELECT value FROM view_event_attribute_value_index where value like :value and block_height > :startHeight and block_height <= :endHeight',
      {
        value: `${config.networkPrefixAddress}%`,
        startHeight,
        endHeight,
      }
    );

    if (resultTx.rows.length > 0)
      resultTx.rows.map((res: any) => eventAddresses.push(res.value));

    const addresses = Array.from(
      new Set(
        eventAddresses.filter(
          (addr: string) =>
            Utils.isValidAccountAddress(
              addr,
              config.networkPrefixAddress,
              20
            ) ||
            Utils.isValidAccountAddress(addr, config.networkPrefixAddress, 32)
        )
      )
    );

    await knex
      .transaction(async (trx) => {
        if (addresses.length > 0)
          await this.insertNewAccountAndUpdate(addresses, trx);

        updateBlockCheckpoint.height = endHeight;
        await BlockCheckpoint.query()
          .insert(updateBlockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      })
      .then(() =>
        this.broker.call(SERVICE.V1.CrawlAccountService.UpdateAccount.path, {
          addresses,
        })
      )
      .catch((error) => {
        this.logger.error(error);
        throw error;
      });
  }

  private async insertNewAccountAndUpdate(
    addresses: string[],
    trx: Knex.Transaction
  ) {
    const accounts: Account[] = [];

    const existedAccounts: string[] = (
      await Account.query().select('*').whereIn('address', addresses)
    ).map((account: Account) => account.address);

    addresses.forEach((address: string) => {
      if (!existedAccounts.includes(address)) {
        const account: Account = Account.fromJson({
          address,
          evm_address: convertBech32AddressToEthAddress(
            config.networkPrefixAddress,
            address
          ).toLowerCase(),
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

    if (accounts.length > 0) {
      await trx
        .batchInsert('account', accounts, config.crawlGenesis.accountsPerBatch)
        .catch((error) => {
          this.logger.error(
            `Error insert new account: ${JSON.stringify(accounts)}`
          );
          this.logger.error(error);
        });
    }
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

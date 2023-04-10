/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { fromBase64, fromUtf8 } from '@cosmjs/encoding';
import {
  AccountType,
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
  IAllBalances,
  IAuraJSClientFactory,
  ICoin,
  IAddressesParam,
  REDIS_KEY,
  SERVICE,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  Account,
  AccountVesting,
  BlockCheckpoint,
  IBalance,
} from '../../models';

@Service({
  name: SERVICE.V1.CrawlAccountService.key,
  version: 1,
})
export default class CrawlAccountService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @Action({
    name: SERVICE.V1.CrawlAccountService.UpdateAccount.key,
    params: {
      addresses: 'string[]',
    },
  })
  public actionUpdateAccount(ctx: Context<IAddressesParam>) {
    this.createJobAccount(ctx.params.addresses);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_GENESIS_ACCOUNT,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobCrawlGenesisAccount(_payload: object): Promise<void> {
    const crawlGenesisAccountBlockCheckpoint: BlockCheckpoint | undefined =
      await BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_GENESIS_ACCOUNT);

    if (config.networkPrefixAddress === 'aura') {
      if (
        crawlGenesisAccountBlockCheckpoint &&
        crawlGenesisAccountBlockCheckpoint.height > 0
      )
        return;

      let addresses: string[] = [];

      try {
        const genesis = await this._httpBatchClient.execute(
          createJsonRpcRequest('genesis')
        );

        addresses = genesis.result.genesis.app_state.bank.balances.map(
          (balance: any) => balance.address
        );
      } catch (error: any) {
        if (JSON.parse(error.message).code !== -32603) {
          this.logger.error(error);
          return;
        }

        let genesisChunk = '';
        let index = 0;
        let done = false;
        while (!done) {
          try {
            this.logger.info(`Query genesis_chunked at page ${index}`);
            const resultChunk = await this._httpBatchClient.execute(
              createJsonRpcRequest('genesis_chunked', {
                chunk: index.toString(),
              })
            );

            genesisChunk += fromUtf8(fromBase64(resultChunk.result.data));
            index += 1;
          } catch (err) {
            if (JSON.parse(error.message).code !== -32603) {
              this.logger.error(error);
              return;
            }

            done = true;
          }
        }

        const genesisChunkObject: any = JSON.parse(genesisChunk);
        addresses = genesisChunkObject.app_state.bank.balances.map(
          (balance: any) => balance.address
        );
      }

      const listAccounts: Account[] = [];
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
          listAccounts.push(account);
        }
      });

      if (listAccounts.length > 0) await Account.query().insert(listAccounts);

      this.createJobAccount(addresses);
    }

    let updateBlockCheckpoint: BlockCheckpoint;
    if (crawlGenesisAccountBlockCheckpoint) {
      updateBlockCheckpoint = crawlGenesisAccountBlockCheckpoint;
      updateBlockCheckpoint.height = 1;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_GENESIS_ACCOUNT,
        height: 1,
      });
    await BlockCheckpoint.query()
      .insert(updateBlockCheckpoint)
      .onConflict('job_name')
      .merge()
      .returning('id');
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountAuth(_payload: IAddressesParam): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccounts: Account[] = [];
    const listAccountVestings: AccountVesting[] = [];

    if (_payload.addresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.addresses);

      await Promise.all(
        _payload.addresses.map(async (address: string) => {
          this.logger.info(`Crawl account auth address: ${address}`);

          const account: Account | undefined = accounts.find(
            (acc: Account) => acc.address === address
          );

          if (account) {
            let resultCallApi;
            try {
              resultCallApi =
                await this._lcdClient.auranw.cosmos.auth.v1beta1.account({
                  address,
                });
            } catch (error) {
              this.logger.error(error);
              throw error;
            }

            account.type = resultCallApi.account['@type'];
            switch (resultCallApi.account['@type']) {
              case AccountType.CONTINUOUS_VESTING:
              case AccountType.DELAYED_VESTING:
              case AccountType.PERIODIC_VESTING:
                account.pubkey =
                  resultCallApi.account.base_vesting_account.base_account.pub_key;
                account.account_number = Number.parseInt(
                  resultCallApi.account.base_vesting_account.base_account
                    .account_number,
                  10
                );
                account.sequence = Number.parseInt(
                  resultCallApi.account.base_vesting_account.base_account
                    .sequence,
                  10
                );
                break;
              case AccountType.MODULE:
                account.pubkey = resultCallApi.account.base_account.pub_key;
                account.account_number = Number.parseInt(
                  resultCallApi.account.base_account.account_number,
                  10
                );
                account.sequence = Number.parseInt(
                  resultCallApi.account.base_account.sequence,
                  10
                );
                break;
              default:
                account.pubkey = resultCallApi.account.pub_key;
                account.account_number = Number.parseInt(
                  resultCallApi.account.account_number,
                  10
                );
                account.sequence = Number.parseInt(
                  resultCallApi.account.sequence,
                  10
                );
                break;
            }

            listAccounts.push(account);

            if (
              resultCallApi.account['@type'] ===
                AccountType.CONTINUOUS_VESTING ||
              resultCallApi.account['@type'] === AccountType.DELAYED_VESTING ||
              resultCallApi.account['@type'] === AccountType.PERIODIC_VESTING
            ) {
              const accountVesting: AccountVesting = AccountVesting.fromJson({
                account_id: account.id,
                original_vesting:
                  resultCallApi.account.base_vesting_account.original_vesting,
                delegated_free:
                  resultCallApi.account.base_vesting_account.delegated_free,
                delegated_vesting:
                  resultCallApi.account.base_vesting_account.delegated_vesting,
                start_time: resultCallApi.account.start_time
                  ? Number.parseInt(resultCallApi.account.start_time, 10)
                  : null,
                end_time: resultCallApi.account.base_vesting_account.end_time,
              });
              listAccountVestings.push(accountVesting);
            }
          }
        })
      );

      await Account.query()
        .insert(listAccounts)
        .onConflict('address')
        .merge()
        .returning('id')
        .catch((error) => {
          this.logger.error('Error insert account auth');
          this.logger.error(error);
        });

      if (listAccountVestings.length > 0) {
        await AccountVesting.query()
          .insert(listAccountVestings)
          .onConflict('account_id')
          .merge()
          .returning('id')
          .catch((error) => {
            this.logger.error('Error insert account vesting');
            this.logger.error(error);
          });
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_BALANCES,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountBalances(
    _payload: IAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccounts: Account[] = [];

    if (_payload.addresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.addresses);

      await Promise.all(
        _payload.addresses.map(async (address: string) => {
          this.logger.info(`Crawl account balances address: ${address}`);

          const account: Account | undefined = accounts.find(
            (acc: Account) => acc.address === address
          );

          if (account) {
            let listBalances: IBalance[] = [];
            let done = false;
            let resultCallApi;
            const params: IAllBalances = {
              address,
            };
            while (!done) {
              try {
                resultCallApi =
                  await this._lcdClient.auranw.cosmos.bank.v1beta1.allBalances(
                    params
                  );
              } catch (error) {
                this.logger.error(error);
                throw error;
              }

              if (resultCallApi.balances.length > 0) {
                listBalances.push(...resultCallApi.balances);
              }
              if (resultCallApi.pagination.next_key === null) {
                done = true;
              } else {
                params.pagination = {
                  key: fromBase64(resultCallApi.pagination.next_key),
                };
              }
            }

            if (listBalances.length > 1)
              listBalances = await this.handleIbcDenom(listBalances);

            account.balances = listBalances;

            listAccounts.push(account);
          }
        })
      );

      await Account.query()
        .insert(listAccounts)
        .onConflict('address')
        .merge()
        .returning('id')
        .catch((error) => {
          this.logger.error('Error insert account balance');
          this.logger.error(error);
        });
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountSpendableBalances(
    _payload: IAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccounts: Account[] = [];

    if (_payload.addresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.addresses);

      await Promise.all(
        _payload.addresses.map(async (address: string) => {
          this.logger.info(
            `Crawl account spendable balances address: ${address}`
          );

          const account: Account | undefined = accounts.find(
            (acc: Account) => acc.address === address
          );

          if (account) {
            let listSpendableBalances: IBalance[] = [];
            let done = false;
            let resultCallApi;
            const params: IAllBalances = {
              address,
            };
            while (!done) {
              try {
                resultCallApi =
                  await this._lcdClient.auranw.cosmos.bank.v1beta1.spendableBalances(
                    params
                  );
              } catch (error) {
                this.logger.error(error);
                throw error;
              }

              if (resultCallApi.balances.length > 0) {
                listSpendableBalances.push(...resultCallApi.balances);
              }
              if (resultCallApi.pagination.next_key === null) {
                done = true;
              } else {
                params.pagination = {
                  key: fromBase64(resultCallApi.pagination.next_key),
                };
              }
            }

            if (listSpendableBalances.length > 1)
              listSpendableBalances = await this.handleIbcDenom(
                listSpendableBalances
              );

            account.spendable_balances = listSpendableBalances;

            listAccounts.push(account);
          }
        })
      );

      await Account.query()
        .insert(listAccounts)
        .onConflict('address')
        .merge()
        .returning('id')
        .catch((error) => {
          this.logger.error('Error insert account stake spendable balance');
          this.logger.error(error);
        });
    }
  }

  private async handleIbcDenom(listBalances: ICoin[]) {
    const result = await Promise.all(
      listBalances.map(async (balance) => {
        if (balance.denom.startsWith('ibc/')) {
          const hash = balance.denom.split('/')[1];
          let ibcDenomRedis = await this.broker.cacher?.get(
            REDIS_KEY.IBC_DENOM
          );
          if (ibcDenomRedis === undefined || ibcDenomRedis === null)
            ibcDenomRedis = [];
          const ibcDenom = ibcDenomRedis?.find(
            (ibc: any) => ibc.hash === balance.denom
          );
          if (ibcDenom) {
            return {
              amount: balance.amount,
              denom: balance.denom,
              base_denom: ibcDenom.base_denom,
            };
          }

          let denomResult;
          try {
            denomResult =
              await this._lcdClient.ibc.ibc.applications.transfer.v1.denomTrace(
                { hash }
              );

            ibcDenomRedis?.push({
              base_denom: denomResult.denom_trace.base_denom,
              hash: balance.denom,
            });
            await this.broker.cacher?.set(REDIS_KEY.IBC_DENOM, ibcDenomRedis);
          } catch (error) {
            this.logger.error(error);
            throw error;
          }

          return {
            amount: balance.amount,
            denom: balance.denom,
            base_denom: denomResult.denom_trace.base_denom,
          };
        }
        return balance;
      })
    );

    return result;
  }

  private createJobAccount(addresses: string[]) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
      'crawl',
      {
        addresses,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_BALANCES,
      'crawl',
      {
        addresses,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES,
      'crawl',
      {
        addresses,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_VESTING_ACCOUNT,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleVestingAccounts(_payload: object): Promise<void> {
    const accountVestings: any[] = [];

    const now = Math.floor(
      new Date().setSeconds(new Date().getSeconds() - 6) / 1000
    );
    let offset = 0;
    let done = false;
    while (!done) {
      const result = await AccountVesting.query()
        .joinRelated('account')
        .where((builder) =>
          builder
            .whereIn('account.type', [
              AccountType.CONTINUOUS_VESTING,
              AccountType.PERIODIC_VESTING,
            ])
            .andWhere('end_time', '>=', now)
        )
        .orWhere((builder) =>
          builder
            .where('account.type', AccountType.DELAYED_VESTING)
            .andWhere('end_time', '<=', now)
        )
        .select('account.address')
        .page(offset, 1000);

      if (result.results.length > 0) {
        accountVestings.push(...result.results);
        offset += 1;
      } else done = true;
    }

    await this.handleJobAccountSpendableBalances({
      addresses: accountVestings.map((vesting) => vesting.address),
    });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_GENESIS_ACCOUNT,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.HANDLE_VESTING_ACCOUNT,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlAccount.handleVestingAccount.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}

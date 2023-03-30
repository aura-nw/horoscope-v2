/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { fromBase64, fromUtf8 } from '@cosmjs/encoding';
import AccountVesting from '../../models/account_vesting';
import {
  IAllBalances,
  ICoin,
  IAuraJSClientFactory,
} from '../../common/types/interfaces';
import {
  BULL_JOB_NAME,
  SERVICE_NAME,
  BULL_ACTION_NAME,
  AccountType,
  REDIS_KEY,
} from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { IListAddressesParam } from '../../common/utils/request';
import { Account, IBalance } from '../../models/account';
import { getLcdClient } from '../../common/utils/aurajs_client';
import BlockCheckpoint from '../../models/block_checkpoint';
import { getHttpBatchClient } from '../../common/utils/cosmjs_client';
import config from '../../../config.json';

@Service({
  name: SERVICE_NAME.CRAWL_ACCOUNT,
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
    name: BULL_ACTION_NAME.UPDATE_ACCOUNT,
    params: {
      listAddresses: 'string[]',
    },
  })
  public actionUpdateAccount(ctx: Context<IListAddressesParam>) {
    this.createJobAccount(ctx.params.listAddresses);
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

      let listAddresses: string[] = [];

      try {
        const genesis = await this._httpBatchClient.execute(
          createJsonRpcRequest('genesis')
        );

        listAddresses = genesis.result.genesis.app_state.bank.balances.map(
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
        listAddresses = genesisChunkObject.app_state.bank.balances.map(
          (balance: any) => balance.address
        );
      }

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

      await Account.query().insert(listAccounts);

      this.createJobAccount(listAddresses);
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
  public async handleJobAccountAuth(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccounts: Account[] = [];
    const listAccountVestings: AccountVesting[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
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

      try {
        await Promise.all([
          Account.query()
            .insert(listAccounts)
            .onConflict('address')
            .merge()
            .returning('id'),
          AccountVesting.query()
            .insert(listAccountVestings)
            .onConflict('account_id')
            .merge()
            .returning('id'),
        ]);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_BALANCES,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountBalances(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccounts: Account[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
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

      try {
        await Account.query()
          .insert(listAccounts)
          .onConflict('address')
          .merge()
          .returning('id');
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountSpendableBalances(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccounts: Account[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
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

      try {
        await Account.query()
          .insert(listAccounts)
          .onConflict('address')
          .merge()
          .returning('id');
      } catch (error) {
        this.logger.error(error);
      }
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

  private createJobAccount(listAddresses: string[]) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
      'crawl',
      {
        listAddresses,
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
        listAddresses,
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
        listAddresses,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
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

    return super._start();
  }
}

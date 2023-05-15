/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { cosmos } from '@aura-nw/aurajs';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import Long from 'long';
import {
  QueryAllBalancesRequest,
  QueryAllBalancesResponse,
  QuerySpendableBalancesRequest,
  QuerySpendableBalancesResponse,
} from '@aura-nw/aurajs/types/codegen/cosmos/bank/v1beta1/query';
import knex from '../../common/utils/db_connection';
import {
  AccountType,
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
  IAuraJSClientFactory,
  ICoin,
  IAddressesParam,
  REDIS_KEY,
  SERVICE,
  ABCI_QUERY_PATH,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import { Account, AccountVesting } from '../../models';

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
  private async actionUpdateAccount(ctx: Context<IAddressesParam>) {
    await this.createJobAccount(ctx.params.addresses);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountAuth(_payload: IAddressesParam): Promise<void> {
    this._lcdClient = await getLcdClient();

    const accounts: Account[] = [];
    const accountVestings: AccountVesting[] = [];

    if (_payload.addresses.length > 0) {
      this.logger.info(`Crawl account auth addresses: ${_payload.addresses}`);

      const accountsInDb: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.addresses);

      await Promise.all(
        accountsInDb.map(async (acc) => {
          let resultCallApi;
          try {
            resultCallApi =
              await this._lcdClient.auranw.cosmos.auth.v1beta1.account({
                address: acc.address,
              });
          } catch (error) {
            this.logger.error(error);
            throw error;
          }

          const account = acc;
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

          accounts.push(account);

          if (
            resultCallApi.account['@type'] === AccountType.CONTINUOUS_VESTING ||
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
            accountVestings.push(accountVesting);
          }
        })
      );

      await knex
        .transaction(async (trx) => {
          await Account.query()
            .insert(accounts)
            .onConflict('address')
            .merge()
            .returning('id')
            .transacting(trx)
            .catch((error) => {
              this.logger.error('Error insert account auth');
              this.logger.error(error);
            });

          if (accountVestings.length > 0)
            await AccountVesting.query()
              .insert(accountVestings)
              .onConflict('account_id')
              .merge()
              .returning('id')
              .transacting(trx)
              .catch((error) => {
                this.logger.error('Error insert account vesting');
                this.logger.error(error);
              });
        })
        .catch((error) => {
          this.logger.error(error);
          throw error;
        });
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

    if (_payload.addresses.length > 0) {
      this.logger.info(`Crawl account balances: ${_payload.addresses}`);

      const accounts: Account[] = await Account.query()
        .select('id', 'address', 'balances')
        .whereIn('address', _payload.addresses);
      accounts.forEach((acc) => {
        acc.balances = [];
      });

      let accountsHaveNext: {
        address: string;
        idx: number;
        next_key: Uint8Array | undefined;
      }[] = accounts.map((acc, idx) => ({
        address: acc.address,
        idx,
        next_key: undefined,
      }));

      let done = false;
      while (!done) {
        const batchQueries: any[] = [];

        // generate queries
        accountsHaveNext.forEach((account) => {
          const request: QueryAllBalancesRequest = {
            address: account.address,
          };
          if (account.next_key)
            request.pagination = {
              key: account.next_key,
              limit: Long.fromInt(0),
              offset: Long.fromInt(0),
              countTotal: false,
              reverse: false,
            };
          const data = toHex(
            cosmos.bank.v1beta1.QueryAllBalancesRequest.encode(request).finish()
          );

          batchQueries.push(
            this._httpBatchClient.execute(
              createJsonRpcRequest('abci_query', {
                path: ABCI_QUERY_PATH.ACCOUNT_ALL_BALANCES,
                data,
              })
            )
          );
        });

        const result: JsonRpcSuccessResponse[] = await Promise.all(
          batchQueries
        );
        // decode result
        const accountBalances: QueryAllBalancesResponse[] = result.map((res) =>
          cosmos.bank.v1beta1.QueryAllBalancesResponse.decode(
            fromBase64(res.result.response.value)
          )
        );

        // map to accounts and extract next key
        const newAccHaveNext = [];
        for (let i = 0; i < accountBalances.length; i += 1) {
          const account = accounts[accountsHaveNext[i].idx];
          account.balances.push(...accountBalances[i].balances);
          if (accountBalances[i].pagination?.nextKey.length || -1 > 0)
            newAccHaveNext.push({
              address: account.address,
              idx: accountsHaveNext[i].idx,
              next_key: accountBalances[i].pagination?.nextKey,
            });
        }
        accountsHaveNext = newAccHaveNext;

        done = accountsHaveNext.length === 0;
      }

      await Promise.all(
        accounts.map(async (account) => {
          if (account.balances.length > 1)
            // eslint-disable-next-line no-param-reassign
            account.balances = await this.handleIbcDenom(account.balances);
        })
      );

      await Account.query()
        .insert(accounts)
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

    if (_payload.addresses.length > 0) {
      this.logger.info(
        `Crawl account spendable balances: ${_payload.addresses}`
      );

      const accounts: Account[] = await Account.query()
        .select('id', 'address', 'spendable_balances')
        .whereIn('address', _payload.addresses);
      accounts.forEach((acc) => {
        acc.spendable_balances = [];
      });

      let accountsHaveNext: {
        address: string;
        idx: number;
        next_key: Uint8Array | undefined;
      }[] = accounts.map((acc, idx) => ({
        address: acc.address,
        idx,
        next_key: undefined,
      }));

      let done = false;
      while (!done) {
        const batchQueries: any[] = [];

        // generate queries
        accountsHaveNext.forEach((account) => {
          const request: QuerySpendableBalancesRequest = {
            address: account.address,
          };
          if (account.next_key)
            request.pagination = {
              key: account.next_key,
              limit: Long.fromInt(0),
              offset: Long.fromInt(0),
              countTotal: false,
              reverse: false,
            };
          const data = toHex(
            cosmos.bank.v1beta1.QuerySpendableBalancesRequest.encode(
              request
            ).finish()
          );

          batchQueries.push(
            this._httpBatchClient.execute(
              createJsonRpcRequest('abci_query', {
                path: ABCI_QUERY_PATH.ACCOUNT_SPENDABLE_BALANCES,
                data,
              })
            )
          );
        });

        const result: JsonRpcSuccessResponse[] = await Promise.all(
          batchQueries
        );
        // decode result
        const accountSpendableBalances: QuerySpendableBalancesResponse[] =
          result.map((res) =>
            cosmos.bank.v1beta1.QuerySpendableBalancesResponse.decode(
              fromBase64(res.result.response.value)
            )
          );

        // map to accounts and extract next key
        const newAccHaveNext = [];
        for (let i = 0; i < accountSpendableBalances.length; i += 1) {
          const account = accounts[accountsHaveNext[i].idx];
          account.spendable_balances.push(
            ...accountSpendableBalances[i].balances
          );
          if (accountSpendableBalances[i].pagination?.nextKey.length || -1 > 0)
            newAccHaveNext.push({
              address: account.address,
              idx: accountsHaveNext[i].idx,
              next_key: accountSpendableBalances[i].pagination?.nextKey,
            });
        }
        accountsHaveNext = newAccHaveNext;

        done = accountsHaveNext.length === 0;
      }

      await Promise.all(
        accounts.map(async (account) => {
          if (account.spendable_balances.length > 1)
            // eslint-disable-next-line no-param-reassign
            account.spendable_balances = await this.handleIbcDenom(
              account.spendable_balances
            );
        })
      );

      await Account.query()
        .insert(accounts)
        .onConflict('address')
        .merge()
        .returning('id')
        .catch((error) => {
          this.logger.error('Error insert account stake spendable balance');
          this.logger.error(error);
        });
    }
  }

  private async handleIbcDenom(balances: ICoin[]) {
    let ibcDenomRedis = await this.broker.cacher?.get(REDIS_KEY.IBC_DENOM);
    if (ibcDenomRedis === undefined || ibcDenomRedis === null)
      ibcDenomRedis = {};

    const result = await Promise.all(
      balances.map(async (balance) => {
        if (balance.denom.startsWith('ibc/')) {
          const hash = balance.denom.split('/')[1];
          if (ibcDenomRedis && ibcDenomRedis[balance.denom]) {
            return {
              amount: balance.amount,
              denom: balance.denom,
              base_denom: ibcDenomRedis[balance.denom],
            };
          }

          let denomResult;
          try {
            denomResult =
              await this._lcdClient.ibc.ibc.applications.transfer.v1.denomTrace(
                { hash }
              );

            if (ibcDenomRedis)
              ibcDenomRedis[balance.denom] = denomResult.denom_trace.base_denom;
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

  private async createJobAccount(addresses: string[]) {
    await Promise.all([
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
          attempts: config.jobRetryAttempt,
          backoff: config.jobRetryBackoff,
        }
      ),
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
          attempts: config.jobRetryAttempt,
          backoff: config.jobRetryBackoff,
        }
      ),
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
          attempts: config.jobRetryAttempt,
          backoff: config.jobRetryBackoff,
        }
      ),
    ]);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_VESTING_ACCOUNT,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleVestingAccounts(_payload: object): Promise<void> {
    const addresses: string[] = [];

    const now = Math.floor(
      new Date().setSeconds(new Date().getSeconds() - 6) / 1000
    );
    let page = 0;
    let done = false;
    while (!done) {
      const result = await Account.query()
        .joinRelated('vesting')
        .where((builder) =>
          builder
            .whereIn('account.type', [
              AccountType.CONTINUOUS_VESTING,
              AccountType.PERIODIC_VESTING,
            ])
            .andWhere('vesting.end_time', '>=', now)
        )
        .orWhere((builder) =>
          builder
            .where('account.type', AccountType.DELAYED_VESTING)
            .andWhere('vesting.end_time', '<=', now)
            .andWhere('vesting.end_time', '>', now - 60)
        )
        .select('account.address')
        .page(page, 1000);

      if (result.results.length > 0) {
        result.results.map((res) => addresses.push(res.address));
        page += 1;
      } else done = true;
    }

    await this.handleJobAccountSpendableBalances({
      addresses,
    });
  }

  public async _start() {
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
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );

    return super._start();
  }
}

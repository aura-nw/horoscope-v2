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
import {
  QueryAccountRequest,
  QueryAccountResponse,
} from '@aura-nw/aurajs/types/codegen/cosmos/auth/v1beta1/query';
import knex from '../../common/utils/db_connection';
import {
  AccountType,
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
  IProviderJSClientFactory,
  ICoin,
  IAddressesParam,
  REDIS_KEY,
  SERVICE,
  ABCI_QUERY_PATH,
  PubkeyType,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import { Account, AccountVesting } from '../../models';
import ChainRegistry from '../../common/utils/chain.registry';
import Utils from '../../common/utils/utils';
import { AccountBalance } from '../../models/account_balance';
import { getProviderRegistry } from '../../common/utils/provider.registry';

interface IAccountBalances extends QueryAllBalancesResponse {
  last_updated_height: number;
}

@Service({
  name: SERVICE.V1.CrawlAccountService.key,
  version: 1,
})
export default class CrawlAccountService extends BullableService {
  private _lcdClient!: IProviderJSClientFactory;

  private _httpBatchClient: HttpBatchClient;

  private registry: any;

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
    jobName: BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountAuth(_payload: IAddressesParam): Promise<void> {
    this._lcdClient = await getLcdClient();

    const accounts: any[] = [];
    const accountVestings: AccountVesting[] = [];

    if (_payload.addresses.length > 0) {
      const batchQueries: any[] = [];

      const accountsInDb: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.addresses);

      accountsInDb.forEach((account) => {
        const request: QueryAccountRequest = {
          address: account.address,
        };
        const data = toHex(
          cosmos.auth.v1beta1.QueryAccountRequest.encode(request).finish()
        );

        batchQueries.push(
          this._httpBatchClient.execute(
            createJsonRpcRequest('abci_query', {
              path: ABCI_QUERY_PATH.ACCOUNT_AUTH,
              data,
            })
          )
        );
      });

      const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
      const accountAuthsRes: (QueryAccountResponse | null)[] = result.map(
        (res) =>
          res.result.response.code === 0
            ? cosmos.auth.v1beta1.QueryAccountResponse.decode(
                fromBase64(res.result.response.value)
              )
            : null
      );
      const accountAuths = accountAuthsRes.map((acc) =>
        acc ? Utils.camelizeKeys(this.registry.decodeMsg(acc.account)) : null
      );

      accountAuths.forEach((auth) => {
        if (auth) {
          const account: any = {};
          account.type = auth['@type'];
          switch (auth['@type']) {
            case AccountType.CONTINUOUS_VESTING:
            case AccountType.DELAYED_VESTING:
            case AccountType.PERIODIC_VESTING:
              account.id = accountsInDb.find(
                (acc) =>
                  acc.address === auth.base_vesting_account.base_account.address
              )!.id;
              account.pubkey = auth.base_vesting_account.base_account.pub_key;
              account.account_number = Number.parseInt(
                auth.base_vesting_account.base_account.account_number,
                10
              );
              account.sequence = Number.parseInt(
                auth.base_vesting_account.base_account.sequence,
                10
              );
              break;
            case AccountType.MODULE:
              account.id = accountsInDb.find(
                (acc) => acc.address === auth.base_account.address
              )!.id;
              account.pubkey = auth.base_account.pub_key;
              account.account_number = Number.parseInt(
                auth.base_account.account_number,
                10
              );
              account.sequence = Number.parseInt(
                auth.base_account.sequence,
                10
              );
              break;
            default:
              account.id = accountsInDb.find(
                (acc) => acc.address === auth.address
              )!.id;
              account.pubkey = auth.pub_key;
              account.account_number = Number.parseInt(auth.account_number, 10);
              account.sequence = Number.parseInt(auth.sequence, 10);
              break;
          }

          accounts.push(account);

          if (
            auth['@type'] === AccountType.CONTINUOUS_VESTING ||
            auth['@type'] === AccountType.DELAYED_VESTING ||
            auth['@type'] === AccountType.PERIODIC_VESTING
          ) {
            const accountVesting: AccountVesting = AccountVesting.fromJson({
              account_id: account.id,
              original_vesting: auth.base_vesting_account.original_vesting,
              delegated_free: auth.base_vesting_account.delegated_free,
              delegated_vesting: auth.base_vesting_account.delegated_vesting,
              start_time: auth.start_time
                ? Number.parseInt(auth.start_time, 10)
                : null,
              end_time: auth.base_vesting_account.end_time,
            });
            accountVestings.push(accountVesting);
          }
        }
      });

      await knex
        .transaction(async (trx) => {
          const patchQueries = accounts.map((account) =>
            Account.query()
              .patch({
                type: account.type,
                pubkey: account.pubkey,
                account_number: account.account_number,
                sequence: account.sequence,
              })
              .where({ id: account.id })
              .transacting(trx)
          );
          try {
            await Promise.all(patchQueries);
          } catch (error) {
            this.logger.error(
              `Error update account auth: ${_payload.addresses}`
            );
            this.logger.error(error);
          }

          if (accountVestings.length > 0)
            await AccountVesting.query()
              .insert(accountVestings)
              .onConflict('account_id')
              .merge()
              .returning('id')
              .transacting(trx)
              .catch((error) => {
                this.logger.error(
                  `Error insert account vesting: ${_payload.addresses}`
                );
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
    jobName: BULL_JOB_NAME.CRAWL_ACCOUNT_BALANCES,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountBalances(
    _payload: IAddressesParam
  ): Promise<void> {
    const { addresses } = _payload;
    this._lcdClient = await getLcdClient();

    if (addresses.length > 0) {
      const batchQueries: any[] = [];

      addresses.forEach((address) => {
        const request: QueryAllBalancesRequest = {
          address,
          pagination: {
            key: new Uint8Array(),
            limit: Long.fromInt(200),
            offset: Long.fromInt(0),
            countTotal: false,
            reverse: false,
          },
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

      const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
      const accountBalances: IAccountBalances[] = result.map((res) => ({
        ...cosmos.bank.v1beta1.QueryAllBalancesResponse.decode(
          fromBase64(res.result.response.value)
        ),
        last_updated_height: parseInt(res.result.response.height, 10),
      }));

      const accounts = accountBalances.map((acc, index) => ({
        address: addresses[index],
        balances: acc.balances,
        last_updated_height: acc.last_updated_height,
      }));

      await Promise.all(
        accounts.map(async (account) => {
          if (account.balances.length > 1) {
            // eslint-disable-next-line no-param-reassign
            account.balances = await this.handleIbcDenom(account.balances);
          }
        })
      );
      // Create account_balance
      const listAccountBalance: {
        account_id?: number;
        denom: string;
        amount: string;
        base_denom: string;
        last_updated_height: number;
      }[] = [];
      const addressesWithIds = await Account.query()
        .select('id', 'address')
        .whereIn('address', addresses);
      accounts.forEach((account) => {
        const accountId = addressesWithIds.find(
          (addressWithId) => addressWithId.address === account.address
        )?.id;
        if (Array.isArray(account.balances) && accountId)
          account.balances.forEach((balance) => {
            listAccountBalance.push({
              account_id: accountId,
              denom: balance.denom,
              amount: balance.amount,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              base_denom: balance.base_denom,
              last_updated_height: account.last_updated_height,
            });
          });
      });

      try {
        await knex.transaction(async (trx) => {
          if (listAccountBalance.length > 0)
            await AccountBalance.query()
              .insert(listAccountBalance)
              .onConflict(['account_id', 'denom'])
              .merge()
              .transacting(trx);
          const stringListUpdates = accounts
            .map(
              (account) =>
                `('${account.address}', '${JSON.stringify(
                  account.balances
                )}'::jsonb)`
            )
            .join(',');
          await knex
            .raw(
              `UPDATE account SET balances = temp.balances from (VALUES ${stringListUpdates}) as temp(address, balances) where temp.address = account.address`
            )
            .transacting(trx);
        });
      } catch (error) {
        this.logger.error(
          `Error update account balance: ${_payload.addresses}`
        );
        this.logger.error(error);
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES,
    jobName: BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountSpendableBalances(
    _payload: IAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    if (_payload.addresses.length > 0) {
      const batchQueries: any[] = [];

      _payload.addresses.forEach((address) => {
        const request: QuerySpendableBalancesRequest = {
          address,
          pagination: {
            key: new Uint8Array(),
            limit: Long.fromInt(200),
            offset: Long.fromInt(0),
            countTotal: false,
            reverse: false,
          },
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

      const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
      const accountSpendableBalances: QuerySpendableBalancesResponse[] =
        result.map((res) =>
          cosmos.bank.v1beta1.QuerySpendableBalancesResponse.decode(
            fromBase64(res.result.response.value)
          )
        );

      const accounts = accountSpendableBalances.map((acc, index) => ({
        address: _payload.addresses[index],
        spendable_balances: acc.balances,
      }));

      await Promise.all(
        accounts.map(async (account) => {
          if (account.spendable_balances.length > 1)
            // eslint-disable-next-line no-param-reassign
            account.spendable_balances = await this.handleIbcDenom(
              account.spendable_balances
            );
        })
      );

      const patchQueries = accounts.map((account) =>
        Account.query()
          .patch({
            spendable_balances: account.spendable_balances,
          })
          .where({ address: account.address })
      );
      try {
        await Promise.all(patchQueries);
      } catch (error) {
        this.logger.error(
          `Error update account spendable balance: ${_payload.addresses}`
        );
        this.logger.error(error);
      }
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
        BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
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
        BULL_JOB_NAME.CRAWL_ACCOUNT_BALANCES,
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
        BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES,
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
    jobName: BULL_JOB_NAME.HANDLE_VESTING_ACCOUNT,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleVestingAccounts(_payload: object): Promise<void> {
    const addresses: string[] = [];

    const now = Math.floor(
      new Date().setSeconds(new Date().getSeconds()) / 1000
    );
    let page = 0;
    let done = false;
    while (!done) {
      /* eslint-disable-next-line no-await-in-loop */
      const result = await Account.query()
        .joinRelated('vesting')
        .where((builder) =>
          builder
            .whereIn('account.type', [
              AccountType.CONTINUOUS_VESTING,
              AccountType.PERIODIC_VESTING,
            ])
            .andWhere('vesting.end_time', '>=', now - 6)
        )
        .orWhere((builder) =>
          builder
            .whereIn('account.type', [
              AccountType.CONTINUOUS_VESTING,
              AccountType.PERIODIC_VESTING,
              AccountType.DELAYED_VESTING,
            ])
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
    const providerRegistry = await getProviderRegistry();
    this.registry = new ChainRegistry(this.logger, providerRegistry);
    this.registry.addTypes([
      ...Object.values(AccountType),
      ...Object.values(PubkeyType),
    ]);

    this.createJob(
      BULL_JOB_NAME.HANDLE_VESTING_ACCOUNT,
      BULL_JOB_NAME.HANDLE_VESTING_ACCOUNT,
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

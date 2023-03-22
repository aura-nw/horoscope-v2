/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import AccountVesting from '../../models/account_vesting';
import {
  IAllBalances,
  ICoin,
  IAuraJSClientFactory,
} from '../../common/types/interfaces';
import {
  CONST_CHAR,
  BULL_JOB_NAME,
  SERVICE_NAME,
  BULL_ACTION_NAME,
  AccountType,
  REDIS_KEY,
} from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import { IListAddressesParam } from '../../common/utils/request';
import { Account, IBalance } from '../../models/account';
import { getLcdClient } from '../../common/utils/aurajs_client';

@Service({
  name: SERVICE_NAME.CRAWL_ACCOUNT,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class CrawlAccountService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: BULL_ACTION_NAME.ACCOUNT_UPSERT,
    params: {
      listAddresses: 'string[]',
    },
  })
  public actionAccountUpsert(ctx: Context<IListAddressesParam>) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
      'crawl',
      {
        listAddresses: ctx.params.listAddresses,
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
        listAddresses: ctx.params.listAddresses,
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
        listAddresses: ctx.params.listAddresses,
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
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  public async handleJobAccountAuth(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listUpdateQueries: any[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
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

            listUpdateQueries.push(
              Account.query()
                .where({ id: account.id })
                .patch({
                  type: account.type,
                  pubkey: account.pubkey,
                  account_number: account.account_number ?? 0,
                  sequence: account.sequence ?? 0,
                })
            );

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
              listUpdateQueries.push(
                AccountVesting.query()
                  .insert(accountVesting)
                  .onConflict('account_id')
                  .merge()
                  .returning('id')
              );
            }
          }
        })
      );

      try {
        await Promise.all(listUpdateQueries);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_BALANCES,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  public async handleJobAccountBalances(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listUpdateQueries: any[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
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
                params.pagination = { key: resultCallApi.pagination.next_key };
              }
            }

            if (listBalances.length > 1)
              listBalances = await this.handleIbcDenom(listBalances);

            account.balances = listBalances;

            listUpdateQueries.push(
              Account.query().where({ id: account.id }).patch({
                balances: account.balances,
              })
            );
          }
        })
      );

      try {
        await Promise.all(listUpdateQueries);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  public async handleJobAccountSpendableBalances(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listUpdateQueries: any[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
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
                params.pagination = { key: resultCallApi.pagination.next_key };
              }
            }

            if (listSpendableBalances.length > 1)
              listSpendableBalances = await this.handleIbcDenom(
                listSpendableBalances
              );

            account.spendable_balances = listSpendableBalances;

            listUpdateQueries.push(
              Account.query().where({ id: account.id }).patch({
                spendable_balances: account.spendable_balances,
              })
            );
          }
        })
      );

      try {
        await Promise.all(listUpdateQueries);
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
          const ibcDenomRedis = await this.broker.cacher?.get(
            REDIS_KEY.IBC_DENOM
          );
          const ibcDenom = ibcDenomRedis?.find((ibc: any) => ibc.hash === hash);
          if (ibcDenom) {
            return {
              amount: balance.amount,
              denom: ibcDenom.base_denom,
              minimal_denom: ibcDenom.hash,
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
            denom: denomResult.denom_trace.base_denom,
            minimal_denom: balance.denom,
          };
        }
        return balance;
      })
    );

    return result;
  }
}

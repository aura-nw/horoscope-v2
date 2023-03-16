/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
// import IBCDenom from 'src/models/ibc_denom';
import { AllBalancesRequest } from '../../common/types/interfaces';
import {
  CONST_CHAR,
  BULL_JOB_NAME,
  SERVICE_NAME,
  // URL_TYPE_CONSTANTS,
  BULL_ACTION_NAME,
} from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
// import Utils from '../../common/utils/utils';
import { IListAddressesParam } from '../../common/utils/request';
import { Account, IBalance } from '../../models/account';
import { getLcdClient } from '../../common/utils/aurajs_client';

@Service({
  name: SERVICE_NAME.CRAWL_ACCOUNT,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class CrawlAccountService extends BullableService {
  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: BULL_ACTION_NAME.ACCOUNT_UPSERT,
    params: {
      listAddresses: 'string[]',
    },
  })
  private actionAccountUpsert(ctx: Context<IListAddressesParam>) {
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
  private async handleJobAccountAuth(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listUpdateQueries: any[] = [];

    // const url = Utils.getUrlByChainIdAndType(
    //   Config.CHAIN_ID,
    //   URL_TYPE_CONSTANTS.LCD
    // );

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
          // const param = `${Config.GET_PARAMS_AUTH_INFO}/${address}`;

          const account: Account | undefined = accounts.find(
            (acc: Account) => acc.address === address
          );

          if (account) {
            let resultCallApi;
            try {
              // resultCallApi = await this.callApiFromDomain(url, param);
              resultCallApi = await this._lcdClient.cosmos.auth.v1beta1.account(
                { address }
              );
            } catch (error) {
              this.logger.error(error);
              throw error;
            }

            account.type = resultCallApi.account['@type'];
            account.pubkey = resultCallApi.account.pub_key;
            account.account_number = Number.parseInt(
              resultCallApi.account.account_number,
              10
            );
            account.sequence = Number.parseInt(
              resultCallApi.account.sequence,
              10
            );

            listUpdateQueries.push(Account.query().update(account));
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
  private async handleJobAccountBalances(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listUpdateQueries: any[] = [];

    // const url = Utils.getUrlByChainIdAndType(
    //   Config.CHAIN_ID,
    //   URL_TYPE_CONSTANTS.LCD
    // );

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
          // const param = `${Config.GET_PARAMS_BALANCE}/${address}?pagination.limit=100`;

          const account: Account | undefined = accounts.find(
            (acc: Account) => acc.address === address
          );

          if (account) {
            const listBalances: IBalance[] = [];
            // let urlToCall = param;
            let done = false;
            let resultCallApi;
            const params: AllBalancesRequest = {
              address,
            };
            while (!done) {
              try {
                resultCallApi =
                  await this._lcdClient.cosmos.bank.v1beta1.allBalances(params);
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
                // urlToCall = `${param}&pagination.key=${encodeURIComponent(
                //   resultCallApi.pagination.next_key
                // )}`;
                params.pagination = { key: resultCallApi.pagination.next_key };
              }
            }

            // if (listBalances.length > 1) {
            //   await Promise.all(
            //     listBalances.map(async (balance) => {
            //       if (balance.denom.startsWith('ibc/')) {
            //         const hash = balance.denom.split('/')[1];
            //         const ibcDenom: IBCDenom | undefined =
            //           await IBCDenom.query()
            //             .select('*')
            //             .findOne({ hash: balance.denom });
            //         if (ibcDenom) {
            //           return {
            //             amount: balance.amount,
            //             denom: ibcDenom.base_denom,
            //             minimal_denom: ibcDenom.hash,
            //           };
            //         }
            //         const hashParam = `${Config.GET_PARAMS_IBC_DENOM}/${hash}`;
            //         let denomResult;
            //         try {
            //           denomResult = await this.callApiFromDomain(
            //             url,
            //             hashParam
            //           );

            //           await IBCDenom.query().insert(
            //             IBCDenom.fromJson({
            //               path: denomResult.denom_trace.path,
            //               base_denom: denomResult.denom_trace.base_denom,
            //               hash: balance.denom,
            //             })
            //           );
            //         } catch (error) {
            //           this.logger.error(error);
            //           throw error;
            //         }

            //         return {
            //           amount: balance.amount,
            //           denom: denomResult.denom_trace.base_denom,
            //           minimal_denom: balance.denom,
            //         };
            //       }
            //       return balance;
            //     })
            //   );
            // }

            account.balances = listBalances;

            listUpdateQueries.push(Account.query().update(account));
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
  private async handleJobAccountSpendableBalances(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listUpdateQueries: any[] = [];

    // const url = Utils.getUrlByChainIdAndType(
    //   Config.CHAIN_ID,
    //   URL_TYPE_CONSTANTS.LCD
    // );

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
          // const param = `${Config.GET_PARAMS_SPENDABLE_BALANCE}/${address}?pagination.limit=100`;

          const account: Account | undefined = accounts.find(
            (acc: Account) => acc.address === address
          );

          if (account) {
            const listSpendableBalances: IBalance[] = [];
            // let urlToCall = param;
            let done = false;
            let resultCallApi;
            const params: AllBalancesRequest = {
              address,
            };
            while (!done) {
              try {
                // resultCallApi = await this.callApiFromDomain(url, urlToCall);
                resultCallApi =
                  await this._lcdClient.cosmos.bank.v1beta1.spendableBalances(
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
                // urlToCall = `${param}&pagination.key=${encodeURIComponent(
                //   resultCallApi.pagination.next_key
                // )}`;
                params.pagination = { key: resultCallApi.pagination.next_key };
              }
            }

            // if (listSpendableBalances.length > 1) {
            //   await Promise.all(
            //     listSpendableBalances.map(async (balance) => {
            //       if (balance.denom.startsWith('ibc/')) {
            //         const hash = balance.denom.split('/')[1];
            //         const ibcDenom: IBCDenom | undefined =
            //           await IBCDenom.query()
            //             .select('*')
            //             .findOne({ hash: balance.denom });
            //         if (ibcDenom) {
            //           return {
            //             amount: balance.amount,
            //             denom: ibcDenom.base_denom,
            //             minimal_denom: ibcDenom.hash,
            //           };
            //         }
            //         const hashParam = `${Config.GET_PARAMS_IBC_DENOM}/${hash}`;
            //         let denomResult;
            //         try {
            //           denomResult = await this.callApiFromDomain(
            //             url,
            //             hashParam
            //           );

            //           await IBCDenom.query().insert(
            //             IBCDenom.fromJson({
            //               path: denomResult.denom_trace.path,
            //               base_denom: denomResult.denom_trace.base_denom,
            //               hash: balance.denom,
            //             })
            //           );
            //         } catch (error) {
            //           this.logger.error(error);
            //           throw error;
            //         }

            //         return {
            //           amount: balance.amount,
            //           denom: denomResult.denom_trace.base_denom,
            //           minimal_denom: balance.denom,
            //         };
            //       }
            //       return balance;
            //     })
            //   );
            // }

            account.spendable_balances = listSpendableBalances;

            listUpdateQueries.push(Account.query().update(account));
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
}

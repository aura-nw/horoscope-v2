/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { getLcdClient } from 'src/common/utils/aurajs_client';
import AccountStake from 'src/models/account_stake';
import { Validator } from 'src/models/validator';
import {
  DelegationResponseSDKType,
  RedelegationResponseSDKType,
  UnbondingDelegationSDKType,
} from '@aura-nw/aurajs/types/codegen/cosmos/staking/v1beta1/staking';
import { Config } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  CONST_CHAR,
  SERVICE_NAME,
} from '../../common/constant';
import { IListAddressesParam } from '../../common/utils/request';
import { Account } from '../../models/account';
import {
  IDelegatorDelegations,
  IDelegatorRedelegations,
  IDelegatorUnbonding,
} from '../../common/types/interfaces';

@Service({
  name: SERVICE_NAME.CRAWL_ACCOUNT_STAKE,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class CrawlAccountStakeService extends BullableService {
  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: BULL_ACTION_NAME.ACCOUNT_STAKE_UPSERT,
    params: {
      listAddresses: 'string[]',
    },
  })
  private actionAccountStakeUpsert(ctx: Context<IListAddressesParam>) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_DELEGATIONS,
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
      BULL_JOB_NAME.CRAWL_ACCOUNT_REDELEGATIONS,
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
      BULL_JOB_NAME.CRAWL_ACCOUNT_UNBONDING,
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
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_DELEGATIONS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJobAccountDelegations(
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
            const listDelegations: DelegationResponseSDKType[] = [];
            let done = false;
            let resultCallApi;
            const params: IDelegatorDelegations = {
              delegatorAddr: address,
            };
            while (!done) {
              try {
                resultCallApi =
                  await this._lcdClient.cosmos.staking.v1beta1.delegatorDelegations(
                    params
                  );
              } catch (error) {
                this.logger.error(error);
                throw error;
              }

              if (resultCallApi.delegation_responses.length > 0) {
                listDelegations.push(...resultCallApi.delegation_responses);
              }
              if (resultCallApi.pagination.next_key === null) {
                done = true;
              } else {
                params.pagination = { key: resultCallApi.pagination.next_key };
              }
            }

            const [accountStakes, validators]: [AccountStake[], Validator[]] =
              await Promise.all([
                AccountStake.query()
                  .select('*')
                  .where('account_id', account.id)
                  .andWhere('type', CONST_CHAR.DELEGATE),
                Validator.query()
                  .select('*')
                  .whereIn(
                    'operator_address',
                    listDelegations.map(
                      (delegate) => delegate.delegation?.validator_address || ''
                    )
                  ),
              ]);

            listDelegations.forEach((delegate) => {
              let accountStake: AccountStake | undefined = accountStakes.find(
                (acc: AccountStake) =>
                  acc.validator_src_id ===
                  validators.find(
                    (val) =>
                      val.operator_address ===
                      delegate.delegation?.validator_address
                  )?.id
              );

              if (accountStake) {
                accountStake.balance = delegate.balance?.amount || '0';
                accountStake.shares = Number.parseFloat(
                  delegate.delegation?.shares || '0'
                );

                accountStakes.splice(accountStakes.indexOf(accountStake), 1);
              } else {
                accountStake = AccountStake.fromJson({
                  account_id: account.id,
                  validator_src_id: validators.find(
                    (val) =>
                      val.operator_address ===
                      delegate.delegation?.validator_address
                  )?.id,
                  validator_dst_id: null,
                  type: CONST_CHAR.DELEGATE,
                  shares: Number.parseFloat(delegate.delegation?.shares || '0'),
                  balance: delegate.balance?.amount || '0',
                  creation_height: null,
                  end_time: null,
                });
              }

              listUpdateQueries.push(
                AccountStake.query()
                  .insert(accountStake)
                  .onConflict('id')
                  .merge()
                  .returning('id')
              );
            });

            if (accountStakes.length > 0) {
              accountStakes.map((accStake: AccountStake) =>
                listUpdateQueries.push(
                  AccountStake.query().deleteById(accStake.id)
                )
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
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_REDELEGATIONS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJobAccountRedelegations(
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
            const listRedelegations: RedelegationResponseSDKType[] = [];
            let done = false;
            let resultCallApi;
            const params: IDelegatorRedelegations = {
              delegatorAddr: address,
              srcValidatorAddr: '',
              dstValidatorAddr: '',
            };
            while (!done) {
              try {
                resultCallApi =
                  await this._lcdClient.cosmos.staking.v1beta1.redelegations(
                    params
                  );
              } catch (error) {
                this.logger.error(error);
                throw error;
              }

              if (resultCallApi.redelegation_responses.length > 0) {
                listRedelegations.push(...resultCallApi.redelegation_responses);
              }
              if (resultCallApi.pagination.next_key === null) {
                done = true;
              } else {
                params.pagination = { key: resultCallApi.pagination.next_key };
              }
            }

            const [accountStakes, validators]: [AccountStake[], Validator[]] =
              await Promise.all([
                AccountStake.query()
                  .select('*')
                  .where('account_id', account.id)
                  .andWhere('type', CONST_CHAR.REDELEGATE),
                Validator.query()
                  .select('*')
                  .whereIn(
                    'operator_address',
                    listRedelegations.map(
                      (redelegate) =>
                        redelegate.redelegation?.validator_src_address ||
                        redelegate.redelegation?.validator_dst_address ||
                        ''
                    )
                  ),
              ]);

            listRedelegations.forEach((redelegate) => {
              redelegate.entries.forEach((entry) => {
                let accountStake: AccountStake | undefined = accountStakes.find(
                  (acc: AccountStake) =>
                    acc.validator_src_id ===
                      validators.find(
                        (val) =>
                          val.operator_address ===
                          redelegate.redelegation?.validator_src_address
                      )?.id &&
                    acc.creation_height ===
                      entry.redelegation_entry?.creation_height
                );

                if (!accountStake) {
                  accountStake = AccountStake.fromJson({
                    account_id: account.id,
                    validator_src_id: validators.find(
                      (val) =>
                        val.operator_address ===
                        redelegate.redelegation?.validator_src_address
                    )?.id,
                    validator_dst_id: validators.find(
                      (val) =>
                        val.operator_address ===
                        redelegate.redelegation?.validator_dst_address
                    )?.id,
                    type: CONST_CHAR.REDELEGATE,
                    shares: Number.parseFloat(
                      redelegate.entries[0].redelegation_entry?.shares_dst ||
                        '0'
                    ),
                    balance: redelegate.entries[0].balance || '0',
                    creation_height: entry.redelegation_entry?.creation_height,
                    end_time: entry.redelegation_entry?.completion_time,
                  });
                } else {
                  accountStakes.splice(accountStakes.indexOf(accountStake), 1);
                }

                listUpdateQueries.push(
                  AccountStake.query()
                    .insert(accountStake)
                    .onConflict('id')
                    .merge()
                    .returning('id')
                );
              });
            });

            if (accountStakes.length > 0) {
              accountStakes.map((accStake: AccountStake) =>
                listUpdateQueries.push(
                  AccountStake.query().deleteById(accStake.id)
                )
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
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_UNBONDING,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJobAccountUnbonding(
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
            const listUnbonding: UnbondingDelegationSDKType[] = [];
            let done = false;
            let resultCallApi;
            const params: IDelegatorUnbonding = {
              delegatorAddr: address,
            };
            while (!done) {
              try {
                resultCallApi =
                  await this._lcdClient.cosmos.staking.v1beta1.delegatorUnbondingDelegations(
                    params
                  );
              } catch (error) {
                this.logger.error(error);
                throw error;
              }

              if (resultCallApi.unbonding_responses.length > 0) {
                listUnbonding.push(...resultCallApi.unbonding_responses);
              }
              if (resultCallApi.pagination.next_key === null) {
                done = true;
              } else {
                params.pagination = { key: resultCallApi.pagination.next_key };
              }
            }

            const [accountStakes, validators]: [AccountStake[], Validator[]] =
              await Promise.all([
                AccountStake.query()
                  .select('*')
                  .where('account_id', account.id)
                  .andWhere('type', CONST_CHAR.UNBOND),
                Validator.query()
                  .select('*')
                  .whereIn(
                    'operator_address',
                    listUnbonding.map((unbond) => unbond.validator_address)
                  ),
              ]);

            listUnbonding.forEach((unbond) => {
              unbond.entries.forEach((entry) => {
                let accountStake: AccountStake | undefined = accountStakes.find(
                  (acc: AccountStake) =>
                    acc.validator_src_id ===
                      validators.find(
                        (val) =>
                          val.operator_address === unbond.validator_address
                      )?.id &&
                    acc.creation_height === entry.creation_height.toNumber()
                );

                if (!accountStake) {
                  accountStake = AccountStake.fromJson({
                    account_id: account.id,
                    validator_src_id: validators.find(
                      (val) => val.operator_address === unbond.validator_address
                    )?.id,
                    validator_dst_id: null,
                    type: CONST_CHAR.UNBOND,
                    shares: null,
                    balance: entry.balance,
                    creation_height: entry.creation_height,
                    end_time: entry.completion_time,
                  });
                } else {
                  accountStakes.splice(accountStakes.indexOf(accountStake), 1);
                }

                listUpdateQueries.push(
                  AccountStake.query()
                    .insert(accountStake)
                    .onConflict('id')
                    .merge()
                    .returning('id')
                );
              });
            });

            if (accountStakes.length > 0) {
              accountStakes.map((accStake: AccountStake) =>
                listUpdateQueries.push(
                  AccountStake.query().deleteById(accStake.id)
                )
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

  // TODO: Need interval job to delete finished redelegate and unbond
}

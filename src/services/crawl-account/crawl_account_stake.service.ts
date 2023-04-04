/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import {
  DelegationResponseSDKType,
  RedelegationResponseSDKType,
  UnbondingDelegationSDKType,
} from '@aura-nw/aurajs/types/codegen/cosmos/staking/v1beta1/staking';
import {
  BULL_JOB_NAME,
  getLcdClient,
  IAuraJSClientFactory,
  IDelegatorDelegations,
  IDelegatorRedelegations,
  IDelegatorUnbonding,
  IListAddressesParam,
  SERVICE,
  SERVICE_NAME,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json';
import {
  Account,
  AccountStake,
  TransactionEventAttribute,
  Validator,
} from '../../models';

@Service({
  name: SERVICE_NAME.CRAWL_ACCOUNT_STAKE,
  version: 1,
})
export default class CrawlAccountStakeService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.CrawlAccountStake.UpdateAccountStake.key,
    params: {
      listAddresses: 'string[]',
    },
  })
  private actionUpdateAccountStake(ctx: Context<IListAddressesParam>) {
    const { listAddresses } = ctx.params;

    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_DELEGATIONS,
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
      BULL_JOB_NAME.CRAWL_ACCOUNT_REDELEGATIONS,
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
      BULL_JOB_NAME.CRAWL_ACCOUNT_UNBONDING,
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_DELEGATIONS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountDelegations(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccountDelegations: AccountStake[] = [];
    const listDeletes: AccountStake[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
          this.logger.info(`Crawl account delegations address: ${address}`);

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
                  await this._lcdClient.auranw.cosmos.staking.v1beta1.delegatorDelegations(
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

            if (listDelegations.length > 0) {
              const [accountStakes, validators]: [AccountStake[], Validator[]] =
                await Promise.all([
                  AccountStake.query()
                    .select('*')
                    .where('account_id', account.id)
                    .andWhere(
                      'type',
                      TransactionEventAttribute.EVENT_KEY.DELEGATE
                    ),
                  Validator.query()
                    .select('*')
                    .whereIn(
                      'operator_address',
                      listDelegations.map(
                        (delegate) =>
                          delegate.delegation?.validator_address || ''
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
                    type: TransactionEventAttribute.EVENT_KEY.DELEGATE,
                    shares: Number.parseFloat(
                      delegate.delegation?.shares || '0'
                    ),
                    balance: delegate.balance?.amount || '0',
                    creation_height: null,
                    end_time: null,
                  });
                }

                listAccountDelegations.push(accountStake);
              });

              if (accountStakes.length > 0) {
                listDeletes.push(...accountStakes);
              }
            }
          }
        })
      );

      if (listAccountDelegations.length > 0)
        try {
          await AccountStake.query()
            .insert(listAccountDelegations)
            .onConflict('id')
            .merge()
            .returning('id');
        } catch (error) {
          this.logger.error('Error insert account stake delegate');
          this.logger.error(error);
        }

      if (listDeletes.length > 0)
        try {
          await AccountStake.query()
            .delete(true)
            .whereIn(
              'id',
              listDeletes.map((del) => del.id)
            );
        } catch (error) {
          this.logger.error('Error delete account stake delegate');
          this.logger.error(error);
        }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_REDELEGATIONS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountRedelegations(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccountRedelegations: AccountStake[] = [];
    const listDeletes: AccountStake[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
          this.logger.info(`Crawl account redelegations address: ${address}`);

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
                  await this._lcdClient.auranw.cosmos.staking.v1beta1.redelegations(
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

            if (listRedelegations.length > 0) {
              const listValidators: string[] = [];
              listRedelegations.map((redelegate) =>
                listValidators.push(
                  ...[
                    redelegate.redelegation?.validator_src_address ?? '',
                    redelegate.redelegation?.validator_dst_address ?? '',
                  ]
                )
              );
              const [accountStakes, validators]: [AccountStake[], Validator[]] =
                await Promise.all([
                  AccountStake.query()
                    .select('*')
                    .where('account_id', account.id)
                    .andWhere(
                      'type',
                      TransactionEventAttribute.EVENT_KEY.REDELEGATE
                    ),
                  Validator.query()
                    .select('*')
                    .whereIn('operator_address', listValidators),
                ]);

              listRedelegations.forEach((redelegate) => {
                redelegate.entries.forEach((entry) => {
                  let accountStake: AccountStake | undefined =
                    accountStakes.find(
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
                      type: TransactionEventAttribute.EVENT_KEY.REDELEGATE,
                      shares: Number.parseFloat(
                        redelegate.entries[0].redelegation_entry?.shares_dst ||
                          '0'
                      ),
                      balance: redelegate.entries[0].balance || '0',
                      creation_height:
                        entry.redelegation_entry?.creation_height,
                      end_time: entry.redelegation_entry?.completion_time,
                    });
                  } else {
                    accountStakes.splice(
                      accountStakes.indexOf(accountStake),
                      1
                    );
                  }

                  listAccountRedelegations.push(accountStake);
                });
              });

              if (accountStakes.length > 0) {
                listDeletes.push(...accountStakes);
              }
            }
          }
        })
      );

      if (listAccountRedelegations.length > 0)
        try {
          await AccountStake.query()
            .insert(listAccountRedelegations)
            .onConflict('id')
            .merge()
            .returning('id');
        } catch (error) {
          this.logger.error('Error insert account stake redelegate');
          this.logger.error(error);
        }

      if (listDeletes.length > 0)
        try {
          await AccountStake.query()
            .delete(true)
            .whereIn(
              'id',
              listDeletes.map((del) => del.id)
            );
        } catch (error) {
          this.logger.error('Error delete account stake redelegate');
          this.logger.error(error);
        }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_UNBONDING,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobAccountUnbonding(
    _payload: IListAddressesParam
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listAccountUnbondings: AccountStake[] = [];
    const listDeletes: AccountStake[] = [];

    if (_payload.listAddresses.length > 0) {
      const accounts: Account[] = await Account.query()
        .select('*')
        .whereIn('address', _payload.listAddresses);

      await Promise.all(
        _payload.listAddresses.map(async (address: string) => {
          this.logger.info(`Crawl account unbonding address: ${address}`);

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
                  await this._lcdClient.auranw.cosmos.staking.v1beta1.delegatorUnbondingDelegations(
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

            if (listUnbonding.length > 0) {
              const [accountStakes, validators]: [AccountStake[], Validator[]] =
                await Promise.all([
                  AccountStake.query()
                    .select('*')
                    .where('account_id', account.id)
                    .andWhere(
                      'type',
                      TransactionEventAttribute.EVENT_KEY.UNBOND
                    ),
                  Validator.query()
                    .select('*')
                    .whereIn(
                      'operator_address',
                      listUnbonding.map((unbond) => unbond.validator_address)
                    ),
                ]);

              listUnbonding.forEach((unbond) => {
                unbond.entries.forEach((entry) => {
                  let accountStake: AccountStake | undefined =
                    accountStakes.find(
                      (acc: AccountStake) =>
                        acc.validator_src_id ===
                          validators.find(
                            (val) =>
                              val.operator_address === unbond.validator_address
                          )?.id &&
                        acc.creation_height ===
                          Number.parseInt(entry.creation_height.toString(), 10)
                    );

                  if (!accountStake) {
                    accountStake = AccountStake.fromJson({
                      account_id: account.id,
                      validator_src_id: validators.find(
                        (val) =>
                          val.operator_address === unbond.validator_address
                      )?.id,
                      validator_dst_id: null,
                      type: TransactionEventAttribute.EVENT_KEY.UNBOND,
                      shares: null,
                      balance: entry.balance,
                      creation_height: entry.creation_height,
                      end_time: entry.completion_time,
                    });
                  } else {
                    accountStakes.splice(
                      accountStakes.indexOf(accountStake),
                      1
                    );
                  }

                  listAccountUnbondings.push(accountStake);
                });
              });

              if (accountStakes.length > 0) {
                listDeletes.push(...accountStakes);
              }
            }
          }
        })
      );

      if (listAccountUnbondings.length > 0)
        try {
          await AccountStake.query()
            .insert(listAccountUnbondings)
            .onConflict('id')
            .merge()
            .returning('id');
        } catch (error) {
          this.logger.error('Error insert account stake unbonding');
          this.logger.error(error);
        }

      if (listDeletes.length > 0)
        try {
          await AccountStake.query()
            .delete(true)
            .whereIn(
              'id',
              listDeletes.map((del) => del.id)
            );
        } catch (error) {
          this.logger.error('Error delete account stake unbonding');
          this.logger.error(error);
        }
    }
  }

  // TODO: Need interval job to delete finished redelegate and unbond
}

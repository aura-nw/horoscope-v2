import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { parseCoins } from '@cosmjs/proto-signing';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, ITxIdsParam, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import {
  AccountStake,
  Validator,
  Account,
  TransactionEventAttribute,
  Transaction,
} from '../../models';

@Service({
  name: SERVICE.V1.CrawlAccountStakeService.key,
  version: 1,
})
export default class CrawlAccountStakeService extends BullableService {
  private eventStakes = [
    TransactionEventAttribute.EVENT_KEY.DELEGATE,
    TransactionEventAttribute.EVENT_KEY.REDELEGATE,
    TransactionEventAttribute.EVENT_KEY.UNBOND,
  ];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.CrawlAccountStakeService.UpdateAccountStake.key,
    params: {
      txIds: 'number[]',
    },
  })
  private actionUpdateAccountStake(ctx: Context<ITxIdsParam>) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_STAKE,
      'crawl',
      {
        txIds: ctx.params.txIds,
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
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_STAKE,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: ITxIdsParam): Promise<void> {
    const stakeTxs: any[] = await Transaction.query()
      .joinRelated('events.[attributes]')
      .select(
        'transaction.id',
        'transaction.timestamp',
        'transaction.height',
        'events.id as event_id',
        'events.type',
        'events:attributes.msg_index',
        'events:attributes.key',
        'events:attributes.value'
      )
      .whereIn('transaction.id', _payload.txIds)
      .whereIn('events.type', [
        TransactionEventAttribute.EVENT_KEY.DELEGATE,
        TransactionEventAttribute.EVENT_KEY.REDELEGATE,
        TransactionEventAttribute.EVENT_KEY.UNBOND,
        TransactionEventAttribute.EVENT_KEY.MESSAGE,
      ])
      .andWhere('transaction.code', 0);

    const [validators, accounts, accountDelegations]: [
      Validator[],
      Account[],
      AccountStake[]
    ] = await Promise.all([
      Validator.query(),
      Account.query().whereIn(
        'address',
        stakeTxs
          .filter((tx) => tx.key === TransactionEventAttribute.EVENT_KEY.SENDER)
          .map((tx) => tx.value)
      ),
      AccountStake.query()
        .joinRelated('[account, src_validator]')
        .whereIn(
          'account.address',
          stakeTxs
            .filter(
              (tx) => tx.key === TransactionEventAttribute.EVENT_KEY.SENDER
            )
            .map((tx) => tx.value)
        )
        .andWhere('account_stake.type', AccountStake.TYPES.DELEGATE),
    ]);
    const validatorKeys = _.keyBy(validators, 'operator_address');
    const accountKeys = _.keyBy(accounts, 'address');

    stakeTxs
      .filter((stake) => this.eventStakes.includes(stake.type))
      .filter(
        (stake) =>
          stake.key === TransactionEventAttribute.EVENT_KEY.VALIDATOR ||
          stake.key === TransactionEventAttribute.EVENT_KEY.SOURCE_VALIDATOR
      )
      .forEach((stake) => {
        this.logger.info(`Handle event stake ${JSON.stringify(stake)}`);
        const stakeEvents = stakeTxs.filter(
          (tx) => tx.event_id === stake.event_id
        );

        switch (stake.type) {
          case AccountStake.TYPES.DELEGATE:
            {
              let accStake = accountDelegations.find(
                (acc) => acc.validator_src_id === validatorKeys[stake.value].id
              );
              if (accStake) {
                accStake.balance = (
                  parseInt(accStake.balance, 10) +
                  parseInt(
                    parseCoins(
                      stakeEvents.find(
                        (event) =>
                          event.key ===
                          TransactionEventAttribute.EVENT_KEY.AMOUNT
                      ).value
                    )[0].amount,
                    10
                  )
                ).toString();
              } else {
                accStake = AccountStake.fromJson({
                  account_id:
                    accountKeys[
                      stakeTxs.find(
                        (tx) =>
                          tx.type ===
                            TransactionEventAttribute.EVENT_KEY.MESSAGE &&
                          tx.key ===
                            TransactionEventAttribute.EVENT_KEY.SENDER &&
                          tx.msg_index === stake.msg_index
                      ).value
                    ].id,
                  validator_src_id: validatorKeys[stake.value].id,
                  validator_dst_id: null,
                  type: AccountStake.TYPES.DELEGATE,
                  balance: parseCoins(
                    stakeEvents.find(
                      (event) =>
                        event.key === TransactionEventAttribute.EVENT_KEY.AMOUNT
                    ).value
                  )[0].amount,
                  end_time: null,
                });

                accountDelegations.push(accStake);
              }
            }
            break;
          case AccountStake.TYPES.REDELEGATE:
            {
              const accStakeSrc = accountDelegations.find(
                (acc) => acc.validator_src_id === validatorKeys[stake.value].id
              );
              let accStakeDst = accountDelegations.find(
                (acc) =>
                  acc.validator_src_id ===
                  validatorKeys[
                    stakeEvents.find(
                      (event) =>
                        event.key ===
                        TransactionEventAttribute.EVENT_KEY
                          .DESTINATION_VALIDATOR
                    ).value
                  ].id
              );

              if (accStakeSrc) {
                // if (stakeLeftRedele > 0) {
                accStakeSrc.balance = (
                  parseInt(accStakeSrc.balance, 10) -
                  parseInt(
                    parseCoins(
                      stakeEvents.find(
                        (event) =>
                          event.key ===
                          TransactionEventAttribute.EVENT_KEY.AMOUNT
                      ).value
                    )[0].amount,
                    10
                  )
                ).toString();
                // } else {
                //   accountDelegations.splice(
                //     accountDelegations.indexOf(accStakeSrc),
                //     1
                //   );
                //   accountDel.push(accStakeSrc);
                // }
              }
              if (accStakeDst) {
                accStakeDst.balance = (
                  parseInt(accStakeDst.balance, 10) +
                  parseInt(
                    parseCoins(
                      stakeEvents.find(
                        (event) =>
                          event.key ===
                          TransactionEventAttribute.EVENT_KEY.AMOUNT
                      ).value
                    )[0].amount,
                    10
                  )
                ).toString();
              } else {
                accStakeDst = AccountStake.fromJson({
                  account_id:
                    accountKeys[
                      stakeTxs.find(
                        (tx) =>
                          tx.type ===
                            TransactionEventAttribute.EVENT_KEY.MESSAGE &&
                          tx.key ===
                            TransactionEventAttribute.EVENT_KEY.SENDER &&
                          tx.msg_index === stake.msg_index
                      ).value
                    ].id,
                  validator_src_id:
                    validatorKeys[
                      stakeEvents.find(
                        (event) =>
                          event.key ===
                          TransactionEventAttribute.EVENT_KEY
                            .DESTINATION_VALIDATOR
                      ).value
                    ].id,
                  validator_dst_id: null,
                  type: AccountStake.TYPES.DELEGATE,
                  balance: parseCoins(
                    stakeEvents.find(
                      (event) =>
                        event.key === TransactionEventAttribute.EVENT_KEY.AMOUNT
                    ).value
                  )[0].amount,
                  end_time: null,
                });

                accountDelegations.push(accStakeDst);
              }

              const accRestake = AccountStake.fromJson({
                account_id:
                  accountKeys[
                    stakeTxs.find(
                      (tx) =>
                        tx.type ===
                          TransactionEventAttribute.EVENT_KEY.MESSAGE &&
                        tx.key === TransactionEventAttribute.EVENT_KEY.SENDER &&
                        tx.msg_index === stake.msg_index
                    ).value
                  ].id,
                validator_src_id: validatorKeys[stake.value].id,
                validator_dst_id:
                  validatorKeys[
                    stakeEvents.find(
                      (event) =>
                        event.key ===
                        TransactionEventAttribute.EVENT_KEY
                          .DESTINATION_VALIDATOR
                    ).value
                  ].id,
                type: AccountStake.TYPES.REDELEGATE,
                balance: parseCoins(
                  stakeEvents.find(
                    (event) =>
                      event.key === TransactionEventAttribute.EVENT_KEY.AMOUNT
                  ).value
                )[0].amount,
                end_time: stakeEvents.find(
                  (event) =>
                    event.key ===
                    TransactionEventAttribute.EVENT_KEY.COMPLETION_TIME
                ).value,
              });

              accountDelegations.push(accRestake);
            }
            break;
          case AccountStake.TYPES.UNBOND:
            {
              const accStake = accountDelegations.find(
                (acc) => acc.validator_src_id === validatorKeys[stake.value].id
              );

              if (accStake) {
                // if (stakeLeftUnbond > 0) {
                accStake.balance = (
                  parseInt(accStake.balance, 10) -
                  parseInt(
                    parseCoins(
                      stakeEvents.find(
                        (event) =>
                          event.key ===
                          TransactionEventAttribute.EVENT_KEY.AMOUNT
                      ).value
                    )[0].amount,
                    10
                  )
                ).toString();
                // } else {
                //   accountDelegations.splice(
                //     accountDelegations.indexOf(accStake),
                //     1
                //   );
                //   accountDel.push(accStake);
                // }
              }

              const accUnbond = AccountStake.fromJson({
                account_id:
                  accountKeys[
                    stakeTxs.find(
                      (tx) =>
                        tx.type ===
                          TransactionEventAttribute.EVENT_KEY.MESSAGE &&
                        tx.key === TransactionEventAttribute.EVENT_KEY.SENDER &&
                        tx.msg_index === stake.msg_index
                    ).value
                  ].id,
                validator_src_id: validatorKeys[stake.value].id,
                validator_dst_id: null,
                type: AccountStake.TYPES.UNBOND,
                balance: parseCoins(
                  stakeEvents.find(
                    (event) =>
                      event.key === TransactionEventAttribute.EVENT_KEY.AMOUNT
                  ).value
                )[0].amount,
                end_time: stakeEvents.find(
                  (event) =>
                    event.key ===
                    TransactionEventAttribute.EVENT_KEY.COMPLETION_TIME
                ).value,
              });

              accountDelegations.push(accUnbond);
            }
            break;
          default:
            break;
        }
      });

    const accountUpd = accountDelegations.filter(
      (acc) => parseInt(acc.balance, 10) > 0
    );
    const accountDel = accountDelegations.filter(
      (acc) => parseInt(acc.balance, 10) <= 0
    );

    if (accountUpd.length > 0)
      await AccountStake.query()
        .insert(accountDelegations)
        .onConflict('id')
        .merge()
        .returning('id')
        .catch((error) => {
          this.logger.error('Error insert or update account stakes');
          this.logger.error(error);
        });

    if (accountDel.length > 0)
      await AccountStake.query()
        .delete(true)
        .whereIn(
          'id',
          accountDel.map((del) => del.id)
        )
        .catch((error) => {
          this.logger.error('Error delete account stake');
          this.logger.error(error);
        });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ACCOUNT_STAKE_END_TIME,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleAccountStakeEndTime(_payload: object): Promise<void> {
    const now = new Date(
      Math.floor(new Date().setSeconds(new Date().getSeconds() - 6) / 1000)
    );

    await AccountStake.query().delete(true).where('end_time', '<=', now);
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.HANDLE_ACCOUNT_STAKE_END_TIME,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.crawlAccountStake.handleAccountStakeEndTime.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}

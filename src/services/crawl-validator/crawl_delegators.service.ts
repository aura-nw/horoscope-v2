/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { cosmos } from '@aura-nw/aurajs';
import { ServiceBroker } from 'moleculer';
import Long from 'long';
import {fromBase64, toHex} from '@cosmjs/encoding';
import { Knex } from 'knex';
import BigNumber from 'bignumber.js';
import {createJsonRpcRequest} from '@cosmjs/tendermint-rpc/build/jsonrpc';
import {QueryValidatorDelegationsResponse} from '@aura-nw/aurajs/types/codegen/cosmos/staking/v1beta1/query';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  BULL_JOB_NAME,
  getLcdClient,
  getHttpBatchClient,
  IProviderJSClientFactory,
  IPagination,
  IValidatorDelegators,
  SERVICE,
  MSG_TYPE, ABCI_QUERY_PATH,
} from '../../common';
import {
  BlockCheckpoint,
  Delegator,
  Transaction,
  TransactionMessage,
  Validator,
} from '../../models';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CrawlDelegatorsService.key,
  version: 1,
})
export default class CrawlDelegatorsService extends BullableService {
  private _lcdClient!: IProviderJSClientFactory;

  private _httpBatchClient!: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description: Sync all delegator of validator
   * @note: Delete all and crawl again delegator, so all delegator will be crawled from RPC instead of from
   * transaction_message table, so you need to stop CRAWL_DELEGATORS job and wait until this update complete, this job
   * will update checkpoint of CRAWL_DELEGATORS job, set it to latest transaction_message, then you can start CRAWL_DELEGATORS
   * again
   */
  @Action({
    name: SERVICE.V1.CrawlDelegatorsService.updateAllValidator.key,
  })
  public async updateAllValidator(): Promise<void> {
    await knex.raw(
      `TRUNCATE TABLE ${Delegator.tableName} RESTART IDENTITY CASCADE`
    );
    await Delegator.query().delete(true).where('id', '>', 0);
    const validators: Validator[] = await Validator.query();
    const jobCrawlDelegators = validators.map((validator) =>
      this.createJob(
        BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
        BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
        {
          id: validator.id,
          address: validator.operator_address,
          height: validator.delegators_last_height,
        },
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          attempts: config.jobRetryAttempt,
          backoff: config.jobRetryBackoff,
        }
      )
    );
    await Promise.all(jobCrawlDelegators);
    const latestTransactionMessage = await TransactionMessage.query()
      .orderBy('id', 'DESC')
      .limit(1);
    await BlockCheckpoint.query()
      .update({
        height: latestTransactionMessage[0].id,
      })
      .where({
        job_name: BULL_JOB_NAME.CHECKPOINT_UPDATE_DELEGATOR,
      });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
    jobName: BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
  })
  public async handleJobCrawlValidatorDelegators(
    _payload: IValidatorDelegators
  ): Promise<void> {
    this.logger.info(`Update delegator for validator ${_payload.address}`);
    this._lcdClient = await getLcdClient();

    const delegations = [];
    const delegators: Delegator[] = [];

    let resultCallApi;
    let done = false;
    const pagination: IPagination = {
      limit: Long.fromInt(config.crawlDelegators.queryPageLimit),
    };

    while (!done) {
      resultCallApi =
        await this._lcdClient.provider.cosmos.staking.v1beta1.validatorDelegations(
          {
            validatorAddr: _payload.address,
            pagination,
          }
        );

      delegations.push(...resultCallApi.delegation_responses);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        pagination.key = fromBase64(resultCallApi.pagination.next_key);
      }
    }

    if (delegations.length > 0) {
      delegations.forEach((delegate) => {
        delegators.push(
          Delegator.fromJson({
            validator_id: _payload.id,
            delegator_address: delegate.delegation.delegator_address,
            amount: delegate.balance.amount,
          })
        );
      });
    }

    const latestBlock: BlockCheckpoint | undefined =
      await BlockCheckpoint.query()
        .where('job_name', BULL_JOB_NAME.CRAWL_BLOCK)
        .first();

    await knex.transaction(async (trx) => {
      await Promise.all([
        Delegator.query()
          .insert(delegators)
          .onConflict(['validator_id', 'delegator_address'])
          .merge()
          .transacting(trx)
          .catch((error) => {
            this.logger.error(
              `Insert or update validator delegators error: ${_payload.address}`
            );
            this.logger.error(error);
          }),
        Delegator.query()
          .delete(true)
          .whereNotIn(
            'delegator_address',
            delegators.map((delegate) => delegate.delegator_address)
          )
          .andWhere('validator_id', _payload.id)
          .transacting(trx),
        Validator.query()
          .patch({
            delegators_count: delegations.length,
            delegators_last_height: latestBlock
              ? latestBlock.height
              : _payload.height,
          })
          .where('id', _payload.id)
          .transacting(trx),
      ]);
    });
  }

  // =================================================END OLD LOGIC=========================================================

  public async getCheckpointUpdateDelegator(): Promise<BlockCheckpoint> {
    let checkpointDelegator = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.CHECKPOINT_UPDATE_DELEGATOR,
    });

    if (!checkpointDelegator) {
      const oldestTransactionMessage = await TransactionMessage.query()
        .orderBy('id', 'ASC')
        .limit(1);

      if (oldestTransactionMessage.length === 0) {
        throw Error('No transaction message found.');
      }

      checkpointDelegator = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CHECKPOINT_UPDATE_DELEGATOR,
        height: oldestTransactionMessage[0].id - 1,
      });

      await BlockCheckpoint.query().insert(checkpointDelegator);
    }

    return checkpointDelegator;
  }

  public async handleDelegateTxMsg(
    delegateTxMsg: TransactionMessage,
    trx: Knex.Transaction
  ): Promise<void> {
    const validator = await Validator.query().findOne(
      'operator_address',
      delegateTxMsg.content.validator_address
    );

    if (!validator) {
      this.logger.info('No validator found!');
      return;
    }

    const delegator = await Delegator.query().findOne({
      delegator_address: delegateTxMsg.content.delegator_address,
      validator_id: validator.id,
    });

    if (!delegator) {
      await trx(Delegator.tableName).insert(
        Delegator.fromJson({
          validator_id: validator.id,
          delegator_address: delegateTxMsg.content.delegator_address,
          amount: delegateTxMsg.content.amount.amount,
        })
      );
      await trx(Validator.tableName)
        .update({
          delegators_count: validator.delegators_count + 1,
        })
        .where({
          id: validator.id,
        });
    } else {
      await trx(Delegator.tableName)
        .update({
          amount: BigNumber(delegator.amount)
            .plus(delegateTxMsg.content.amount.amount)
            .toString(),
        })
        .where({
          id: delegator.id,
        });
    }
  }

  public async handleReDelegateTxMsg(
    reDelegateTxMsg: TransactionMessage,
    trx: Knex.Transaction
  ): Promise<void> {
    const validatorSrc = await Validator.query().findOne(
      'operator_address',
      reDelegateTxMsg.content.validator_src_address
    );
    const validatorDst = await Validator.query().findOne(
      'operator_address',
      reDelegateTxMsg.content.validator_dst_address
    );

    if (!validatorSrc || !validatorDst) {
      this.logger.info('No validator found!');
      return;
    }

    const delegatorSrc = await Delegator.query().findOne({
      delegator_address: reDelegateTxMsg.content.delegator_address,
      validator_id: validatorSrc.id,
    });
    const delegatorDst = await Delegator.query().findOne({
      delegator_address: reDelegateTxMsg.content.delegator_address,
      validator_id: validatorDst.id,
    });

    if (delegatorSrc) {
      const remainDelegateSrcAmount = BigNumber(delegatorSrc.amount).minus(
        reDelegateTxMsg.content.amount.amount
      );
      if (remainDelegateSrcAmount.gt(0)) {
        await trx(Delegator.tableName)
          .update({
            amount: remainDelegateSrcAmount.toString(),
          })
          .where({
            id: delegatorSrc.id,
          });
      } else {
        await trx(Delegator.tableName).delete().where({
          id: delegatorSrc.id,
        });
        await trx(Validator.tableName)
          .update({
            delegators_count: validatorSrc.delegators_count - 1,
          })
          .where({
            id: validatorSrc.id,
          });
      }
    }

    if (!delegatorDst) {
      await trx(Delegator.tableName).insert(
        Delegator.fromJson({
          validator_id: validatorDst.id,
          delegator_address: reDelegateTxMsg.content.delegator_address,
          amount: reDelegateTxMsg.content.amount.amount,
        })
      );
      await trx(Validator.tableName)
        .update({
          delegators_count: validatorDst.delegators_count + 1,
        })
        .where({
          id: validatorDst.id,
        });
    } else {
      await trx(Delegator.tableName)
        .update({
          amount: BigNumber(delegatorDst.amount)
            .plus(reDelegateTxMsg.content.amount.amount)
            .toString(),
        })
        .where({
          id: delegatorDst.id,
        });
    }
  }

  public async handleUnDelegateTxMsg(
    unDelegateTxMsg: TransactionMessage,
    trx: Knex.Transaction
  ): Promise<void> {
    const validator = await Validator.query().findOne(
      'operator_address',
      unDelegateTxMsg.content.validator_address
    );

    if (!validator) {
      this.logger.info('No validator found!');
      return;
    }

    const delegator = await Delegator.query().findOne({
      delegator_address: unDelegateTxMsg.content.delegator_address,
      validator_id: validator.id,
    });

    if (!delegator) return;

    const remainDelegateAmount = BigNumber(delegator.amount).minus(
      unDelegateTxMsg.content.amount.amount
    );

    if (remainDelegateAmount.gt(0)) {
      await trx(Delegator.tableName)
        .update({
          amount: remainDelegateAmount.toString(),
        })
        .where({
          id: delegator.id,
        });
    } else {
      await trx(Delegator.tableName).delete().where({
        id: delegator.id,
      });
      await trx(Validator.tableName)
        .update({
          delegators_count: validator.delegators_count - 1,
        })
        .where({
          id: validator.id,
        });
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_DELEGATORS,
    jobName: BULL_JOB_NAME.CRAWL_DELEGATORS,
  })
  public async handleJob(): Promise<void> {
    // Job will run after crawl validator job
    const latestBlockCrawlValidator = await BlockCheckpoint.query().findOne(
      'job_name',
      BULL_JOB_NAME.CRAWL_VALIDATOR
    );
    if (!latestBlockCrawlValidator) return;
    const oldestTransactionByHeight = await Transaction.query()
      .where('height', '=', latestBlockCrawlValidator.height)
      .orderBy('id', 'ASC')
      .limit(1);
    if (oldestTransactionByHeight.length === 0) return;

    const checkpointDelegator = await this.getCheckpointUpdateDelegator();
    const txMsg = await TransactionMessage.query()
      .where('id', '>', checkpointDelegator.height)
      .andWhere('tx_id', '<', oldestTransactionByHeight[0].id)
      .whereIn('type', [
        MSG_TYPE.MSG_DELEGATE,
        MSG_TYPE.MSG_REDELEGATE,
        MSG_TYPE.MSG_UNDELEGATE,
        MSG_TYPE.MSG_CANCEL_UNDELEGATE,
      ])
      .orderBy('id', 'ASC')
      .limit(config.crawlDelegators.txMsgPageLimit);

    if (!txMsg || txMsg.length === 0) {
      this.logger.info('No transaction message found for delegation actions!');
      return;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const msg of txMsg) {
      const trx = await knex.transaction();
      try {
        switch (msg.type) {
          case MSG_TYPE.MSG_DELEGATE:
            await this.handleDelegateTxMsg(msg, trx);
            break;
          case MSG_TYPE.MSG_REDELEGATE:
            await this.handleReDelegateTxMsg(msg, trx);
            break;
          case MSG_TYPE.MSG_UNDELEGATE:
            await this.handleUnDelegateTxMsg(msg, trx);
            break;
          case MSG_TYPE.MSG_CANCEL_UNDELEGATE:
            await this.handleDelegateTxMsg(msg, trx);
            break;
          default:
            break;
        }
        await trx(BlockCheckpoint.tableName)
          .update({
            height: msg.id,
          })
          .where({
            job_name: BULL_JOB_NAME.CHECKPOINT_UPDATE_DELEGATOR,
          });

        await trx.commit();
      } catch (error) {
        this.logger.error(error);
        await trx.rollback();
      }
    }
    this.logger.info('Update validator delegators');
  }

  public async getValidatorDelegations(
    validatorOperatorAddress: string,
    validatorId: number,
    height: number
  ): Promise<Delegator[]> {
    this._httpBatchClient = getHttpBatchClient();
    const delegators: Delegator[] = [];
    const request = {
      validatorAddr: validatorOperatorAddress,
      pagination: {
        key: new Uint8Array(),
        limit: Long.fromInt(10),
        offset: Long.fromInt(0),
        countTotal: true,
        reverse: false,
      },
    };

    while (1) {
      const data = toHex(
        cosmos.staking.v1beta1.QueryValidatorDelegationsRequest.encode(request).finish()
      );
      const resultCallApi = await this._httpBatchClient.execute(
        createJsonRpcRequest('abci_query', {
          path: ABCI_QUERY_PATH.VALIDATOR_DELEGATIONS,
          data,
          height: height.toString(),
        })
      );
      const delegations: (QueryValidatorDelegationsResponse | null) = resultCallApi.result.response.code === 0
        ? cosmos.staking.v1beta1.QueryValidatorDelegationsResponse.decode(
          fromBase64(resultCallApi.result.response.value)
        )
        : null;
      console.log(delegations);

      if (!delegations) break;

      delegations?.delegationResponses.forEach((delegation) => {
        delegators.push(Delegator.fromJson({
          validator_id: validatorId,
          delegator_address: delegation.delegation.delegatorAddress,
          amount: delegation.balance.amount,
        }));
      });

      if (
        delegations.pagination?.nextKey &&
        delegations.pagination?.nextKey.length > 0
      ) request.pagination.key = delegations.pagination.nextKey;
      else break;
    }

    return delegators ?? [];
  }

  public async _start() {
    const a = await this.getValidatorDelegations(
      'auravaloper15pzl0s6ym85qx4yeq29rflp702wtx3dntle05a',
      69,
      5238142
    );
    console.log(a, 'aaaaaaaaaaaa');
    if (1) return;
    this.createJob(
      BULL_JOB_NAME.CRAWL_DELEGATORS,
      BULL_JOB_NAME.CRAWL_DELEGATORS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlDelegators.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}

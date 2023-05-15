/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { ServiceBroker } from 'moleculer';
import Long from 'long';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { cosmos } from '@aura-nw/aurajs';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import {
  QueryDelegationRequest,
  QueryDelegationResponse,
} from '@aura-nw/aurajs/types/codegen/cosmos/staking/v1beta1/query';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { Knex } from 'knex';
import { Validator } from '../../models/validator';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
  IAuraJSClientFactory,
  IPagination,
  SERVICE,
} from '../../common';
import { BlockCheckpoint, EventAttribute } from '../../models';

@Service({
  name: SERVICE.V1.CrawlValidatorService.key,
  version: 1,
})
export default class CrawlValidatorService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR,
    jobName: 'crawl',
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleCrawlAllValidator(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_VALIDATOR,
        BULL_JOB_NAME.HANDLE_TRANSACTION
      );
    this.logger.info(`startHeight: ${startHeight}, endHeight: ${endHeight}`);
    if (startHeight >= endHeight) return;

    const resultTx = await EventAttribute.query()
      .whereIn('key', [
        EventAttribute.ATTRIBUTE_KEY.VALIDATOR,
        EventAttribute.ATTRIBUTE_KEY.SOURCE_VALIDATOR,
        EventAttribute.ATTRIBUTE_KEY.DESTINATION_VALIDATOR,
      ])
      .andWhere('block_height', '>', startHeight)
      .andWhere('block_height', '<=', endHeight)
      .select('value')
      .limit(1)
      .offset(0);
    this.logger.info(
      `Result get Tx from height ${startHeight} to ${endHeight}:`
    );
    this.logger.info(JSON.stringify(resultTx));

    await knex.transaction(async (trx) => {
      if (resultTx.length > 0) {
        await this.updateValidators(trx);
      }

      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id')
        .transacting(trx);
    });
  }

  private async updateValidators(trx: Knex.Transaction) {
    let updateValidators: Validator[] = [];
    const validators: any[] = [];

    let resultCallApi;
    let done = false;
    const pagination: IPagination = {
      limit: Long.fromInt(config.crawlValidator.queryPageLimit),
    };

    while (!done) {
      resultCallApi =
        await this._lcdClient.auranw.cosmos.staking.v1beta1.validators({
          pagination,
        });

      validators.push(...resultCallApi.validators);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        pagination.key = fromBase64(resultCallApi.pagination.next_key);
      }
    }

    const validatorInDB: Validator[] = await knex('validator').select('*');

    await Promise.all(
      validators.map(async (validator) => {
        this.logger.info(`Update validator: ${validator.operator_address}`);

        const foundValidator = validatorInDB.find(
          (val: Validator) =>
            val.operator_address === validator.operator_address
        );

        let validatorEntity: Validator;
        if (!foundValidator) {
          validatorEntity = Validator.createNewValidator(validator);
        } else {
          validatorEntity = foundValidator;
          validatorEntity.jailed = validator.jailed;
          validatorEntity.status = validator.status;
          validatorEntity.tokens = validator.tokens;
          validatorEntity.delegator_shares = validator.delegator_shares;
          validatorEntity.unbonding_height = Number.parseInt(
            validator.unbonding_height,
            10
          );
          validatorEntity.unbonding_time = validator.unbonding_time;
          validatorEntity.commission = validator.commission;
          validatorEntity.jailed_until = (
            foundValidator.jailed_until as unknown as Date
          ).toISOString();
        }

        updateValidators.push(validatorEntity);
      })
    );

    updateValidators = await this.loadCustomInfo(updateValidators);

    await Validator.query()
      .insert(updateValidators)
      .onConflict('operator_address')
      .merge()
      .returning('id')
      .transacting(trx)
      .catch((error) => {
        this.logger.error('Error insert or update validators');
        this.logger.error(error);
      });
  }

  private async loadCustomInfo(validators: Validator[]): Promise<Validator[]> {
    const batchQueries: any[] = [];

    const pool = await this._lcdClient.auranw.cosmos.staking.v1beta1.pool();

    validators.forEach((validator: Validator) => {
      const request: QueryDelegationRequest = {
        delegatorAddr: validator.account_address,
        validatorAddr: validator.operator_address,
      };
      const data = toHex(
        cosmos.staking.v1beta1.QueryDelegationRequest.encode(request).finish()
      );

      batchQueries.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.VALIDATOR_DELEGATION,
            data,
          })
        )
      );
    });

    const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
    const delegations: (QueryDelegationResponse | null)[] = result.map(
      (res: JsonRpcSuccessResponse) =>
        res.result.response.value
          ? cosmos.staking.v1beta1.QueryDelegationResponse.decode(
              fromBase64(res.result.response.value)
            )
          : null
    );

    validators.forEach((val: Validator) => {
      const delegation = delegations.find(
        (dele) =>
          dele?.delegationResponse?.delegation?.validatorAddress ===
          val.operator_address
      );

      val.self_delegation_balance =
        delegation?.delegationResponse?.balance?.amount ?? '0';
      val.percent_voting_power =
        Number(
          (BigInt(val.tokens) * BigInt(100000000)) /
            BigInt(pool.pool.bonded_tokens)
        ) / 1000000;
    });

    return validators;
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_VALIDATOR,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlValidator.millisecondCrawl,
        },
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );

    return super._start();
  }
}

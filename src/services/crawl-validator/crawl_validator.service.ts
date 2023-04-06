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
  SERVICE_NAME,
} from '../../common';
import {
  Block,
  BlockCheckpoint,
  TransactionEventAttribute,
} from '../../models';

@Service({
  name: SERVICE_NAME.CRAWL_VALIDATOR,
  version: 1,
})
export default class CrawlValidatorService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  // To crawl all validators at genesis
  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_GENESIS_VALIDATOR,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleCrawlValidatorsAtGenesis(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const crawlGenesisValidatorBlockCheckpoint: BlockCheckpoint | undefined =
      await BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_GENESIS_VALIDATOR);

    if (
      crawlGenesisValidatorBlockCheckpoint?.height === 0 ||
      !crawlGenesisValidatorBlockCheckpoint
    ) {
      await this.updateValidators();

      let updateBlockCheckpoint: BlockCheckpoint;
      if (crawlGenesisValidatorBlockCheckpoint) {
        updateBlockCheckpoint = crawlGenesisValidatorBlockCheckpoint;
        updateBlockCheckpoint.height = 1;
      } else
        updateBlockCheckpoint = BlockCheckpoint.fromJson({
          job_name: BULL_JOB_NAME.CRAWL_GENESIS_VALIDATOR,
          height: 1,
        });
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleCrawlAllValidator(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const [crawlValidatorBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_VALIDATOR),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);
    this.logger.info(
      `Block Checkpoint: ${JSON.stringify(crawlValidatorBlockCheckpoint)}`
    );

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (crawlValidatorBlockCheckpoint) {
      lastHeight = crawlValidatorBlockCheckpoint.height;
      updateBlockCheckpoint = crawlValidatorBlockCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_VALIDATOR,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === lastHeight) return;

      const resultTx = await TransactionEventAttribute.query()
        .joinRelated('event.[transaction]')
        .whereIn('transaction_event_attribute.key', [
          TransactionEventAttribute.EVENT_KEY.VALIDATOR,
          TransactionEventAttribute.EVENT_KEY.SOURCE_VALIDATOR,
          TransactionEventAttribute.EVENT_KEY.DESTINATION_VALIDATOR,
        ])
        .andWhere('event:transaction.height', '>', lastHeight)
        .andWhere('event:transaction.height', '<=', latestBlock.height)
        .select(
          'event:transaction.id',
          'event:transaction.height',
          'transaction_event_attribute.key',
          'transaction_event_attribute.value'
        )
        .limit(1)
        .offset(0);
      this.logger.info(
        `Query Tx from height ${lastHeight} to ${latestBlock.height}`
      );

      if (resultTx.length > 0) {
        await this.updateValidators();
      }

      updateBlockCheckpoint.height = latestBlock.height;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
    }
  }

  private async updateValidators() {
    let listUpdateValidators: Validator[] = [];
    const listValidator: any[] = [];

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

      listValidator.push(...resultCallApi.validators);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        pagination.key = fromBase64(resultCallApi.pagination.next_key);
      }
    }

    const listValidatorInDB: Validator[] = await knex('validator').select('*');

    await Promise.all(
      listValidator.map(async (validator) => {
        this.logger.info(`Update validator: ${validator.operator_address}`);

        const foundValidator = listValidatorInDB.find(
          (validatorInDB: Validator) =>
            validatorInDB.operator_address === validator.operator_address
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

        listUpdateValidators.push(validatorEntity);
      })
    );

    listUpdateValidators = await this.loadCustomInfo(listUpdateValidators);

    await Validator.query()
      .insert(listUpdateValidators)
      .onConflict('operator_address')
      .merge()
      .returning('id')
      .catch((error) => {
        this.logger.error('Error insert or update validators');
        this.logger.error(error);
      });
  }

  private async loadCustomInfo(
    listValidators: Validator[]
  ): Promise<Validator[]> {
    const listPromise: any[] = [];

    const pool = await this._lcdClient.auranw.cosmos.staking.v1beta1.pool();

    await Promise.all(
      listValidators.map(async (validator: Validator) => {
        const request: QueryDelegationRequest = {
          delegatorAddr: validator.account_address,
          validatorAddr: validator.operator_address,
        };
        const data = toHex(
          cosmos.staking.v1beta1.QueryDelegationRequest.encode(request).finish()
        );

        listPromise.push(
          this._httpBatchClient.execute(
            createJsonRpcRequest('abci_query', {
              path: ABCI_QUERY_PATH.VALIDATOR_DELEGATION,
              data,
            })
          )
        );
      })
    );

    const result: JsonRpcSuccessResponse[] = await Promise.all(listPromise);
    const delegations: QueryDelegationResponse[] = result.map(
      (res: JsonRpcSuccessResponse) =>
        cosmos.staking.v1beta1.QueryDelegationResponse.decode(
          fromBase64(res.result.response.value)
        )
    );

    listValidators.forEach((val: Validator) => {
      const delegation = delegations.find(
        (dele: QueryDelegationResponse) =>
          dele.delegationResponse?.delegation?.validatorAddress ===
          val.operator_address
      );

      val.self_delegation_balance =
        delegation?.delegationResponse?.balance?.amount ?? '';
      val.percent_voting_power =
        Number(
          (BigInt(val.tokens) * BigInt(100000000)) /
            BigInt(pool.pool.bonded_tokens)
        ) / 1000000;
    });

    return listValidators;
  }

  public async _start() {
    // To crawl all validators at genesis
    this.createJob(
      BULL_JOB_NAME.CRAWL_GENESIS_VALIDATOR,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );

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
      }
    );

    return super._start();
  }
}

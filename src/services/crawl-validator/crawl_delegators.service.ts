/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Long from 'long';
import { fromBase64 } from '@cosmjs/encoding';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  BULL_JOB_NAME,
  getLcdClient,
  IAuraJSClientFactory,
  IPagination,
  IValidatorDelegators,
  SERVICE,
} from '../../common';
import { BlockCheckpoint, Delegator, Validator } from '../../models';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CrawlDelegatorsService.key,
  version: 1,
})
export default class CrawlDelegatorsService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_DELEGATORS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    this.logger.info('Update validator delegators');
    const validators: Validator[] = await Validator.query();

    validators.forEach(async (val) => {
      await this.createJob(
        BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
        'crawl',
        {
          id: val.id,
          address: val.operator_address,
          height: val.delegators?.height ?? 0,
        },
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJobCrawlValidatorDelegators(
    _payload: IValidatorDelegators
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const delegations: any[] = [];
    let delegators: Delegator[] = [];

    let resultCallApi;
    let done = false;
    const pagination: IPagination = {
      limit: Long.fromInt(config.crawlDelegators.queryPageLimit),
    };

    while (!done) {
      resultCallApi =
        await this._lcdClient.auranw.cosmos.staking.v1beta1.validatorDelegations(
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
      delegators = delegations.map((delegate) =>
        Delegator.fromJson({
          validator_id: _payload.id,
          delegator_address: delegate.delegation.delegator_address,
          amount: delegate.balance.amount,
        })
      );
    }

    const latestBlock: BlockCheckpoint | undefined =
      await BlockCheckpoint.query()
        .where('job_name', BULL_JOB_NAME.CRAWL_BLOCK)
        .first();
    this.logger.info(
      `Update delegators of validator ${_payload.address} with previous height ${_payload.height} and current height ${latestBlock?.height}`
    );

    await knex.transaction(async (trx) => {
      await Promise.all([
        Delegator.query()
          .insert(delegators)
          .onConflict('id')
          .merge()
          .returning('id')
          .transacting(trx)
          .catch((error) => {
            this.logger.error('Insert or update validator delegators error');
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
            delegators: {
              total: delegations.length,
              height: latestBlock ? latestBlock.height : _payload.height,
            },
          })
          .where('id', _payload.id)
          .transacting(trx)
          .catch((error) => {
            this.logger.error('Update validator error');
            this.logger.error(error);
          }),
      ]);
    });
  }

  public async _start() {
    // this.createJob(
    //   BULL_JOB_NAME.CRAWL_DELEGATORS,
    //   'crawl',
    //   {},
    //   {
    //     removeOnComplete: true,
    //     removeOnFail: {
    //       count: 3,
    //     },
    //     // repeat: {
    //     //   every: config.crawlDelegators.millisecondCrawl,
    //     // },
    //   }
    // );
    this.logger.info(
      await Validator.query()
        .patch({ delegators: { total: 12, height: 23 } })
        .where('id', 1)
        .catch((error) => {
          this.logger.error('Update validator error');
          this.logger.error(error);
        })
    );
    this.logger.info('done');

    return super._start();
  }
}

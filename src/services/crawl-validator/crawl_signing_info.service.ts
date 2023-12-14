/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
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
  SERVICE,
} from '../../common';
import { Validator } from '../../models';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CrawlSigningInfoService.key,
  version: 1,
})
export default class CrawlSigningInfoService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_SIGNING_INFO,
    jobName: BULL_JOB_NAME.CRAWL_SIGNING_INFO,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    this.logger.info('Update validator signing info');
    this._lcdClient = await getLcdClient();

    const updateValidators: Validator[] = [];
    const signingInfos: any[] = [];

    let foundValidators: Validator[] = [];
    await knex.transaction(async (trx) => {
      foundValidators = await Validator.query()
        .select('*')
        .forUpdate()
        .transacting(trx);
    });

    if (foundValidators.length > 0) {
      const paramSlashing =
        await this._lcdClient.aura.cosmos.slashing.v1beta1.params();

      let resultCallApi;
      let done = false;
      const pagination: IPagination = {
        limit: Long.fromInt(config.crawlValidator.queryPageLimit),
      };

      while (!done) {
        resultCallApi =
          await this._lcdClient.aura.cosmos.slashing.v1beta1.signingInfos({
            pagination,
          });

        signingInfos.push(...resultCallApi.info);
        if (resultCallApi.pagination.next_key === null) {
          done = true;
        } else {
          pagination.key = fromBase64(resultCallApi.pagination.next_key);
        }
      }

      await Promise.all(
        foundValidators.map((foundValidator: Validator) => {
          try {
            const signingInfo = signingInfos.find(
              (sign: any) => sign.address === foundValidator.consensus_address
            );

            if (signingInfo) {
              let uptime = 0;
              if (paramSlashing?.params) {
                const blockWindow =
                  paramSlashing?.params.signed_blocks_window.toString();
                const missedBlock =
                  signingInfo.missed_blocks_counter.toString();
                uptime =
                  Number(
                    ((BigInt(blockWindow) - BigInt(missedBlock)) *
                      BigInt(100000000)) /
                      BigInt(blockWindow)
                  ) / 1000000;
              }

              const updateValidator = foundValidator;
              updateValidator.start_height = Number.parseInt(
                signingInfo.start_height,
                10
              );
              updateValidator.index_offset = Number.parseInt(
                signingInfo.index_offset,
                10
              );
              updateValidator.jailed_until = signingInfo.jailed_until;
              updateValidator.tombstoned = signingInfo.tombstoned;
              updateValidator.missed_blocks_counter = Number.parseInt(
                signingInfo.missed_blocks_counter,
                10
              );
              updateValidator.uptime = uptime;
              updateValidators.push(updateValidator);

              return Validator.query()
                .patch({
                  start_height: updateValidator.start_height,
                  index_offset: updateValidator.index_offset,
                  jailed_until: updateValidator.jailed_until,
                  tombstoned: updateValidator.tombstoned,
                  missed_blocks_counter: updateValidator.missed_blocks_counter,
                  uptime: updateValidator.uptime,
                })
                .where('id', updateValidator.id);
            }
          } catch (error) {
            this.logger.error(error);
          }
          return Promise.resolve(null);
        })
      );
      this.logger.info('Update validator signing info done');
    }
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_SIGNING_INFO,
      BULL_JOB_NAME.CRAWL_SIGNING_INFO,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlSigningInfo.millisecondCrawl ?? undefined,
          pattern: config.crawlSigningInfo.patternCrawl ?? undefined,
        },
      }
    );

    return super._start();
  }
}

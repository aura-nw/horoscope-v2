/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import CrawlTxService from '../crawl-tx/crawl_tx.service';
import AuraRegistry from '../crawl-tx/aura.registry';

@Service({
  name: SERVICE.V1.JobService.CrawlMissingTxInBlock.key,
  version: 1,
})
export default class JobCrawlMissingTxInBlock extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  crawlTxService: CrawlTxService = new ServiceBroker({
    logger: true,
  }).createService(CrawlTxService) as CrawlTxService;

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CRAWL_MISSING_TX_IN_BLOCK,
    jobName: BULL_JOB_NAME.JOB_CRAWL_MISSING_TX_IN_BLOCK,
  })
  async crawlMissingTxInBlock(_payload: { height: number }) {
    const listTxRaw = await this.crawlTxService.getListRawTx(
      _payload.height - 1,
      _payload.height
    );
    const listdecodedTx = await this.crawlTxService.decodeListRawTx(listTxRaw);
    await knex.transaction(async (trx) => {
      await this.crawlTxService.insertDecodedTxAndRelated(listdecodedTx, trx);
    });
  }

  @Action({
    name: SERVICE.V1.JobService.CrawlMissingTxInBlock.actionCreateJob.key,
    params: {
      height: 'number',
    },
  })
  public async actionCreateJob(ctx: Context<{ height: number }>) {
    this.createJob(
      BULL_JOB_NAME.JOB_CRAWL_MISSING_TX_IN_BLOCK,
      BULL_JOB_NAME.JOB_CRAWL_MISSING_TX_IN_BLOCK,
      {
        height: ctx.params.height,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  async _start(): Promise<void> {
    this.crawlTxService._registry = new AuraRegistry(
      this.crawlTxService.logger
    );

    return super._start();
  }
}

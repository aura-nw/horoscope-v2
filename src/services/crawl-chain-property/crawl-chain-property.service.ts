import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { callApiMixin } from '../../mixin/callApi/call-api.mixin';
import { ChainProperty } from '../../models/chain_property';
import { BULL_JOB_NAME, URL_TYPE_CONSTANTS } from '../../common/constant';
import Utils from '../../common/utils/utils';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import { ICoin } from '../../common/types/interfaces';

@Service({
  name: 'CrawlChainPropertyService',
  version: 1,
  mixins: [callApiMixin],
})
export default class CrawlChainPropertyService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CHAIN_PROPERTY,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJob(_payload: object): Promise<void> {
    const url = Utils.getUrlByChainIdAndType(
      Config.CHAIN_ID,
      URL_TYPE_CONSTANTS.LCD
    );

    const [communityPool, pool, inflation] = await Promise.all([
      this.callApiFromDomain(url, Config.GET_COMMUNITY_POOL),
      this.callApiFromDomain(url, Config.GET_POOL),
      this.callApiFromDomain(url, Config.GET_INFLATION),
    ]);

    let urlToCall = `${Config.GET_SUPPLY}`;
    let done = false;
    let resultCallApi;
    const supply: ICoin[] = [];
    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      resultCallApi = await this.callApiFromDomain(url, urlToCall);

      supply.push(...resultCallApi.supply);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        urlToCall = `${Config.GET_SUPPLY}?pagination.key=${encodeURIComponent(
          resultCallApi.pagination.next_key.toString()
        )}`;
      }
    }

    let chainProperty = await ChainProperty.query().select('*').findOne({});
    if (!chainProperty) {
      chainProperty = ChainProperty.fromJson({
        community_pool: communityPool.pool,
        inflation: Number.parseFloat(inflation.inflation),
        pool: pool.pool,
        supply,
      });
      try {
        await ChainProperty.query().insert(chainProperty);
      } catch (error) {
        this.logger.error(error);
      }
    } else {
      chainProperty.community_pool = communityPool.pool;
      chainProperty.inflation = Number.parseFloat(inflation.inflation);
      chainProperty.pool = pool.pool;
      chainProperty.supply = supply;
      try {
        await chainProperty.$query().update(chainProperty);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_CHAIN_PROPERTY,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: parseInt(Config.MILISECOND_CRAWL_CHAIN_PROPERTY, 10),
        },
      }
    );

    return super._start();
  }
}

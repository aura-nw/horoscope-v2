/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Long from 'long';
// import { ibc, cosmos } from '@aura-nw/aurajs';
import { fromBase64 } from '@cosmjs/encoding';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  BULL_JOB_NAME,
  IAuraJSClientFactory,
  IPagination,
  SERVICE,
  getLcdClient,
} from '../../common';

@Service({
  name: SERVICE.V1.CrawlIBCService.key,
  version: 1,
})
export default class CrawlIBCService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
  })
  public async crawlIbcConnection() {
    // const client = ibc.ClientFactory;
    // const a = await client.createLCDClient({ restEndpoint: 'asbc' });
    const connections: any[] = [];
    let done = false;
    const pagination: IPagination = {
      limit: Long.fromInt(config.crawlIbcConnection.queryPageLimit),
    };
    // const b = await a.ibc.core.connection.v1.connections();
    // await a.ibc.core.channel.v1.connectionChannels({
    //   connection: 'abc',
    //   pagination,
    // });

    while (!done) {
      const resultCallApi =
        await this._lcdClient.ibc.ibc.core.connection.v1.connections(
          pagination
        );
      if (resultCallApi.height) {
        resultCallApi.connections.forEach((connection: any) => {
          // eslint-disable-next-line no-param-reassign
          connection.height = resultCallApi.height;
        });
      }
      connections.push(...resultCallApi.connections);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        pagination.key = fromBase64(resultCallApi.pagination.next_key);
      }
    }

    this.logger.info('list connection: ');
    this.logger.info(connections);

    connections.forEach(async (connection: any) => {
      this.createJob(
        BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
        BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
        { connection: connection.id },
        {
          removeOnComplete: true,
          removeOnFail: { count: 3 },
          jobId: connection.id,
        }
      );
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
  })
  public async crawlIbcChannel(_payload: { connection: string }) {
    let done = false;
    const pagination: IPagination = {
      limit: Long.fromInt(config.crawlIbcChannel.queryPageLimit),
    };
    const channels: any[] = [];
    while (!done) {
      const resultCallApi =
        await this._lcdClient.ibc.ibc.core.channel.v1.connectionChannels({
          connection: _payload.connection,
          pagination,
        });
      channels.push(...resultCallApi.channels);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        pagination.key = fromBase64(resultCallApi.pagination.next_key);
      }
    }
    this.logger.info(
      'list channel associate with connection : ',
      _payload.connection
    );
    this.logger.info(channels);
  }

  public async _start() {
    this._lcdClient = await getLcdClient();
    this.createJob(
      BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
      BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlIbcConnection.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

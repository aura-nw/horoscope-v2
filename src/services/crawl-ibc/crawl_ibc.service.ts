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
import { IbcChannel, IbcClient } from '../../models';

@Service({
  name: SERVICE.V1.CrawlIBCService.key,
  version: 1,
})
export default class CrawlIBCService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  // query all connection
  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
  })
  public async crawlIbcConnection() {
    const connections: any[] = [];
    let done = false;
    const pagination: IPagination = {
      limit: Long.fromInt(config.crawlIbcConnection.queryPageLimit),
    };
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

    connections.forEach((connection: any) => {
      this.createJob(
        BULL_JOB_NAME.CRAWL_IBC_CLIENT,
        BULL_JOB_NAME.CRAWL_IBC_CLIENT,
        { clientId: connection.client_id },
        {
          removeOnComplete: true,
          removeOnFail: { count: 3 },
          jobId: connection.clientId,
        }
      );

      this.createJob(
        BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
        BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
        { connectionId: connection.id },
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
  public async crawlIbcChannel(_payload: { connectionId: string }) {
    let done = false;
    const pagination: IPagination = {
      limit: Long.fromInt(config.crawlIbcChannel.queryPageLimit),
    };
    const channels: any[] = [];
    while (!done) {
      const resultCallApi =
        await this._lcdClient.ibc.ibc.core.channel.v1.connectionChannels({
          connection: _payload.connectionId,
          pagination,
        });
      resultCallApi.channels.forEach((channel: any) => {
        // eslint-disable-next-line no-param-reassign
        channel.height = resultCallApi.height;
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
      _payload.connectionId
    );
    this.logger.info(channels);
    const ibcChannels = channels.map((channel: any) =>
      IbcChannel.fromJson({
        connection_id: _payload.connectionId,
        channel_id: channel.channel_id,
        state: channel.state,
        ordering: channel.ordering,
        counterparty: channel.counterparty,
        connection_hops: channel.connection_hops,
        version: channel.version,
        port_id: channel.port_id,
        height: channel.height,
      })
    );
    await IbcChannel.query()
      .insert(ibcChannels)
      .onConflict('channel_id')
      .merge();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CLIENT,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CLIENT,
  })
  public async crawlIbcClient(_payload: { clientId: string }) {
    const clientState =
      await this._lcdClient.ibc.ibc.core.client.v1.clientState({
        clientId: _payload.clientId,
      });
    const clientStatus =
      await this._lcdClient.ibc.ibc.core.client.v1.clientStatus({
        clientId: _payload.clientId,
      });

    this.logger.info('client state: ');
    this.logger.info(clientState);
    this.logger.info('client status: ');
    this.logger.info(clientStatus);

    const ibcClient = IbcClient.fromJson({
      client_id: _payload.clientId,
      counterparty_chain_id: clientState.chain_id,
      client_state: clientState,
      client_status: clientStatus.status,
    });

    await IbcClient.query().insert(ibcClient).onConflict('client_id').merge();
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

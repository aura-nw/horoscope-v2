/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { QueryChannelResponseSDKType } from '@aura-nw/aurajs/types/codegen/ibc/core/channel/v1/query';
import { QueryConnectionResponseSDKType } from '@aura-nw/aurajs/types/codegen/ibc/core/connection/v1/query';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  IAuraJSClientFactory,
  SERVICE,
  getLcdClient,
} from '../../common';
import { IbcChannel, IbcClient, IbcConnection } from '../../models';

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
    queueName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION_BY_ID,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION_BY_ID,
  })
  public async crawlIbcConnectionByConnectionID(_payload: {
    connectionId: string;
  }) {
    await this.initLcdClient();
    this.logger.info(
      'Crawling IBC connection by connection id: ',
      _payload.connectionId
    );

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { connection, proof_height }: QueryConnectionResponseSDKType =
      await this._lcdClient.ibc.ibc.core.connection.v1.connection({
        connectionId: _payload.connectionId,
      });
    if (!connection) {
      return;
    }
    const ibcClient = await IbcClient.query().where(
      'client_id',
      connection?.client_id
    );
    if (ibcClient.length === 0) {
      await this.crawlIbcClientById({
        clientId: connection.client_id,
      });
    }
    if (connection) {
      // insert connection ibc
      await IbcConnection.query()
        .insert(
          IbcConnection.fromJson({
            connection_id: _payload.connectionId,
            client_id: connection.client_id,
            versions: JSON.stringify(connection.versions),
            state: connection.state,
            counterparty: connection.counterparty,
            delay_period: connection.delay_period,
            height: proof_height,
          })
        )
        .onConflict('connection_id')
        .merge()
        .catch((err) => {
          this.logger.error(err);
        });
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CHANNEL_BY_ID,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CHANNEL_BY_ID,
  })
  public async crawlIbcChannelById(_payload: {
    channelId: string;
    portId: string;
  }) {
    await this.initLcdClient();
    this.logger.info(
      'Crawl IBC channel by channel_id: ',
      _payload.channelId,
      'and port_id: ',
      _payload.portId
    );

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { channel, proof_height }: QueryChannelResponseSDKType =
      await this._lcdClient.ibc.ibc.core.channel.v1.channel({
        portId: _payload.portId,
        channelId: _payload.channelId,
      });

    if (channel) {
      const connectionHop = channel.connection_hops;
      if (connectionHop.length) {
        const ibcChannelPushDB = IbcChannel.fromJson({
          connection_id: connectionHop.length[connectionHop.length - 1],
          channel_id: _payload.channelId,
          state: channel.state,
          ordering: channel.ordering,
          counterparty: channel.counterparty,
          connection_hops: channel.connection_hops,
          version: channel.version,
          port_id: _payload.portId,
          height: proof_height,
        });
        await IbcChannel.query()
          .insert(ibcChannelPushDB)
          .onConflict('channel_id')
          .merge()
          .catch((err) => {
            this.logger.error(err);
          });
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CLIENT_BY_ID,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CLIENT_BY_ID,
  })
  public async crawlIbcClientById(_payload: { clientId: string }) {
    await this.initLcdClient();
    this.logger.info('Crawling IBC client ID: ', _payload.clientId);
    const [clientState, clientStatus] = await Promise.all([
      this._lcdClient.ibc.ibc.core.client.v1.clientState({
        clientId: _payload.clientId,
      }),
      this._lcdClient.ibc.ibc.core.client.v1.clientStatus({
        clientId: _payload.clientId,
      }),
    ]);

    this.logger.debug('client state: ');
    this.logger.debug(clientState);
    this.logger.debug('client status: ');
    this.logger.debug(clientStatus);

    if (clientState && clientStatus) {
      await IbcClient.query()
        .insert(
          IbcClient.fromJson({
            client_id: _payload.clientId,
            counterparty_chain_id: clientState.client_state.chain_id,
            client_state: clientState,
            status: clientStatus.status,
          })
        )
        .onConflict('client_id')
        .merge()
        .catch((err) => {
          this.logger.error(err);
        });
    }
  }

  async initLcdClient() {
    if (!this._lcdClient) {
      this._lcdClient = await getLcdClient();
    }
  }

  public async _start() {
    await this.initLcdClient();
    return super._start();
  }
}

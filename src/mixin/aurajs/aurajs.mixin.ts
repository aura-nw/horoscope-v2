import { Service, ServiceSchema } from 'moleculer';
import { aura } from '@aura-nw/aurajs';
import { Config } from '../../common';

export default class AurajsMixin
  implements Partial<ServiceSchema>, ThisType<Service>
{
  private _schema: Partial<ServiceSchema> & ThisType<Service>;

  public constructor() {
    // eslint-disable-next-line no-underscore-dangle
    this._schema = {
      methods: {
        async getLCDClient() {
          if (!this._lcdClient) {
            const { createLCDClient } = aura.ClientFactory;
            this._lcdClient = await createLCDClient({
              restEndpoint: Config.LCD_ENDPOINT,
            });
          }
          return this._lcdClient;
        },
        async getRPCClient() {
          if (!this._rpcClient) {
            const { createRPCQueryClient } = aura.ClientFactory;
            this._rpcClient = await createRPCQueryClient({
              rpcEndpoint: Config.RPC_ENDPOINT,
            });
          }
          return this._rpcClient;
        },
      },
    };
  }

  public start() {
    // eslint-disable-next-line no-underscore-dangle
    return this._schema;
  }
}

export const aurajsMixin = new AurajsMixin().start();

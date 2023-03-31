import { cosmwasm } from '@aura-nw/aurajs';
import { Config } from '..';

export default class AuraJsClient {
  public lcdClient: any;

  public rpcClient: any;
}

const client = new AuraJsClient();

export async function getLcdClient() {
  const { createLCDClient } = cosmwasm.ClientFactory;
  if (!client.lcdClient) {
    client.lcdClient = await createLCDClient({
      restEndpoint: Config.LCD_ENDPOINT,
    });
  }
  return client.lcdClient;
}

export async function getRpcClient() {
  const { createRPCQueryClient } = cosmwasm.ClientFactory;
  if (!client.rpcClient) {
    client.rpcClient = await createRPCQueryClient({
      rpcEndpoint: Config.RPC_ENDPOINT,
    });
  }
  return client.rpcClient;
}

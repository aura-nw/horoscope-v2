import { auranw, cosmwasm, ibc } from '@aura-nw/aurajs';
import { Config } from '..';
import { IAuraJSClientFactory } from '../types/interfaces';

export default class AuraJsClient {
  public lcdClient: IAuraJSClientFactory = {
    auranw: null,
    cosmwasm: null,
    ibc: null,
  };

  public rpcClient: IAuraJSClientFactory = {
    auranw: null,
    cosmwasm: null,
    ibc: null,
  };
}

const client = new AuraJsClient();

export async function getLcdClient() {
  if (!client.lcdClient.auranw) {
    const auranwClient = auranw.ClientFactory;
    client.lcdClient.auranw = await auranwClient.createLCDClient({
      restEndpoint: Config.LCD_ENDPOINT,
    });
  }
  if (!client.lcdClient.cosmwasm) {
    const cosmwasmClient = cosmwasm.ClientFactory;
    client.lcdClient.cosmwasm = await cosmwasmClient.createLCDClient({
      restEndpoint: Config.LCD_ENDPOINT,
    });
  }
  if (!client.lcdClient.ibc) {
    const ibcClient = ibc.ClientFactory;
    client.lcdClient.ibc = await ibcClient.createLCDClient({
      restEndpoint: Config.LCD_ENDPOINT,
    });
  }
  return client.lcdClient;
}

export async function getRpcClient() {
  if (!client.rpcClient.auranw) {
    const auranwClient = auranw.ClientFactory;
    client.rpcClient.auranw = await auranwClient.createRPCQueryClient({
      rpcEndpoint: Config.RPC_ENDPOINT,
    });
  }
  if (!client.lcdClient.cosmwasm) {
    const cosmwasmClient = cosmwasm.ClientFactory;
    client.lcdClient.cosmwasm = await cosmwasmClient.createRPCQueryClient({
      rpcEndpoint: Config.RPC_ENDPOINT,
    });
  }
  if (!client.lcdClient.ibc) {
    const ibcClient = ibc.ClientFactory;
    client.lcdClient.ibc = await ibcClient.createRPCQueryClient({
      rpcEndpoint: Config.RPC_ENDPOINT,
    });
  }
  return client.rpcClient;
}

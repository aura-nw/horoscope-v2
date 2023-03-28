import { auranw, cosmwasm, ibc } from '@aura-nw/aurajs';
import { IAuraJSClientFactory } from '../types/interfaces';
import network from '../../../network.json';
import config from '../../../config.json';

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
  const lcd =
    network.find((net: any) => net.chainId === config.chainId)?.LCD[0] || '';

  if (!client.lcdClient.auranw) {
    const auranwClient = auranw.ClientFactory;
    client.lcdClient.auranw = await auranwClient.createLCDClient({
      restEndpoint: lcd,
    });
  }
  if (!client.lcdClient.cosmwasm) {
    const cosmwasmClient = cosmwasm.ClientFactory;
    client.lcdClient.cosmwasm = await cosmwasmClient.createLCDClient({
      restEndpoint: lcd,
    });
  }
  if (!client.lcdClient.ibc) {
    const ibcClient = ibc.ClientFactory;
    client.lcdClient.ibc = await ibcClient.createLCDClient({
      restEndpoint: lcd,
    });
  }
  return client.lcdClient;
}

export async function getRpcClient() {
  const rpc =
    network.find((net: any) => net.chainId === config.chainId)?.RPC[0] || '';

  if (!client.rpcClient.auranw) {
    const auranwClient = auranw.ClientFactory;
    client.rpcClient.auranw = await auranwClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  if (!client.lcdClient.cosmwasm) {
    const cosmwasmClient = cosmwasm.ClientFactory;
    client.lcdClient.cosmwasm = await cosmwasmClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  if (!client.lcdClient.ibc) {
    const ibcClient = ibc.ClientFactory;
    client.lcdClient.ibc = await ibcClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  return client.rpcClient;
}

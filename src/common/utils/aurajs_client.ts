import { aura, cosmwasm, ibc, cosmos } from '@aura-nw/aurajs';
import { IAuraJSClientFactory } from '../types/interfaces';
import network from '../../../network.json' assert { type: 'json' };
import config from '../../../config.json' assert { type: 'json' };

export default class AuraJsClient {
  public lcdClient: IAuraJSClientFactory = {
    aura: null,
    cosmwasm: null,
    ibc: null,
    cosmos: null,
  };

  public rpcClient: IAuraJSClientFactory = {
    aura: null,
    cosmwasm: null,
    ibc: null,
    cosmos: null,
  };
}

const client = new AuraJsClient();

export async function getLcdClient() {
  const lcd =
    network.find((net: any) => net.chainId === config.chainId)?.LCD[0] || '';

  if (!client.lcdClient.aura) {
    const auraClient = aura.ClientFactory;
    client.lcdClient.aura = await auraClient.createLCDClient({
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
  if (!client.lcdClient.cosmos) {
    const cosmosClient = cosmos.ClientFactory;
    client.lcdClient.cosmos = await cosmosClient.createLCDClient({
      restEndpoint: lcd,
    });
  }
  return client.lcdClient;
}

export async function getRpcClient() {
  const rpc =
    network.find((net: any) => net.chainId === config.chainId)?.RPC[0] || '';

  if (!client.rpcClient.aura) {
    const auraClient = aura.ClientFactory;
    client.rpcClient.aura = await auraClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  if (!client.rpcClient.cosmwasm) {
    const cosmwasmClient = cosmwasm.ClientFactory;
    client.rpcClient.cosmwasm = await cosmwasmClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  if (!client.rpcClient.ibc) {
    const ibcClient = ibc.ClientFactory;
    client.rpcClient.ibc = await ibcClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  if (!client.rpcClient.cosmos) {
    const cosmosClient = cosmos.ClientFactory;
    client.rpcClient.cosmos = await cosmosClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  return client.rpcClient;
}

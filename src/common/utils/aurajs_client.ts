import {
  ibc as seiIbc,
  seiprotocol,
  cosmos as seiCosmos,
  cosmwasm as seiCosmwasm,
} from '@horoscope-v2/sei-js-proto';
import {
  aura,
  cosmos as auraCosmos,
  cosmwasm as auraCosmwasm,
  ibc as auraIbc,
} from '@aura-nw/aurajs';
import { IProviderJSClientFactory } from '../types/interfaces';
import network from '../../../network.json' assert { type: 'json' };
import config from '../../../config.json' assert { type: 'json' };
import { chainIdConfigOnServer } from '../constant';

export default class ProviderJsClient {
  public lcdClient: IProviderJSClientFactory = {
    provider: null,
    cosmwasm: null,
    ibc: null,
    cosmos: null,
  };

  public rpcClient: IProviderJSClientFactory = {
    provider: null,
    cosmwasm: null,
    ibc: null,
    cosmos: null,
  };
}

const client = new ProviderJsClient();

export function getProviderFactory(): {
  providerClient: any;
  cosmwasmClient: any;
  ibcClient: any;
  cosmosClient: any;
} {
  switch (config.chainId) {
    case chainIdConfigOnServer.Atlantic2:
    case chainIdConfigOnServer.Pacific1:
      return {
        providerClient: seiprotocol.ClientFactory,
        cosmwasmClient: seiCosmwasm.ClientFactory,
        ibcClient: seiIbc.ClientFactory,
        cosmosClient: seiCosmos.ClientFactory,
      };
    case chainIdConfigOnServer.Euphoria:
    case chainIdConfigOnServer.SerenityTestnet001:
    case chainIdConfigOnServer.AuraTestnet2:
    case chainIdConfigOnServer.Xstaxy1:
    default:
      return {
        providerClient: aura.ClientFactory,
        cosmwasmClient: auraCosmwasm.ClientFactory,
        ibcClient: auraIbc.ClientFactory,
        cosmosClient: auraCosmos.ClientFactory,
      };
  }
}

export async function getLcdClient() {
  const lcd =
    network.find((net: any) => net.chainId === config.chainId)?.LCD[0] || '';

  const { providerClient, cosmwasmClient, ibcClient, cosmosClient } =
    getProviderFactory();

  if (!client.lcdClient.provider) {
    client.lcdClient.provider = await providerClient.createLCDClient({
      restEndpoint: lcd,
    });
    client.lcdClient.cosmwasm = await cosmwasmClient.createLCDClient({
      restEndpoint: lcd,
    });
    client.lcdClient.ibc = await ibcClient.createLCDClient({
      restEndpoint: lcd,
    });
    client.lcdClient.cosmos = await cosmosClient.createLCDClient({
      restEndpoint: lcd,
    });
  }

  return client.lcdClient;
}

export async function getRpcClient() {
  const rpc =
    network.find((net: any) => net.chainId === config.chainId)?.RPC[0] || '';

  const { providerClient, cosmwasmClient, ibcClient, cosmosClient } =
    getProviderFactory();

  if (!client.rpcClient.provider) {
    client.rpcClient.provider = await providerClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
    client.lcdClient.cosmwasm = await cosmwasmClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
    client.lcdClient.ibc = await ibcClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
    client.lcdClient.ibc = await cosmosClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }

  return client.rpcClient;
}

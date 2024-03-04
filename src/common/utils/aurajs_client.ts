import { IProviderJSClientFactory } from '../types/interfaces';
import network from '../../../network.json' assert { type: 'json' };
import config from '../../../config.json' assert { type: 'json' };
import { chainIdConfigOnServer } from '../constant';

export default class AuraJsClient {
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

const client = new AuraJsClient();

export async function getProviderFactory(): Promise<{
  providerClient: any;
  cosmwasmClient: any;
  ibcClient: any;
  cosmosClient: any;
}> {
  let aura;
  let seiprotocol;
  let ibc;
  let cosmos;
  let cosmwasm;
  let provider;

  switch (config.chainId) {
    case chainIdConfigOnServer.Atlantic2:
    case chainIdConfigOnServer.Pacific1:
      ({ ibc, cosmos, cosmwasm, seiprotocol } = await import(
        '@horoscope/sei-js-proto'
      ));
      provider = seiprotocol;
      break;
    case chainIdConfigOnServer.Euphoria:
    case chainIdConfigOnServer.SerenityTestnet001:
    case chainIdConfigOnServer.AuraTestnetEVM:
    case chainIdConfigOnServer.Xstaxy1:
    default:
      ({ ibc, cosmos, cosmwasm, aura } = await import('@aura-nw/aurajs'));
      provider = aura;
      break;
  }
  return {
    providerClient: provider.ClientFactory,
    cosmwasmClient: cosmwasm.ClientFactory,
    ibcClient: ibc.ClientFactory,
    cosmosClient: cosmos.ClientFactory,
  };
}

export async function getLcdClient() {
  const lcd =
    network.find((net: any) => net.chainId === config.chainId)?.LCD[0] || '';

  if (!client.lcdClient.provider) {
    const { providerClient, cosmwasmClient, ibcClient, cosmosClient } =
      await getProviderFactory();
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

  if (!client.rpcClient.provider) {
    const { providerClient, cosmwasmClient, ibcClient, cosmosClient } =
      await getProviderFactory();
    client.rpcClient.provider = await providerClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
    client.lcdClient.cosmwasm = await cosmwasmClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
    client.lcdClient.ibc = await ibcClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
    client.lcdClient.cosmos = await cosmosClient.createRPCQueryClient({
      rpcEndpoint: rpc,
    });
  }
  return client.rpcClient;
}

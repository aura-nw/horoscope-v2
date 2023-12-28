import seiTxRegistryType from 'src/services/crawl-tx/registry-type/sei-network.json';
import auraTxRegistryType from 'src/services/crawl-tx/registry-type/aura-network.json';
import { chainIdConfigOnServer } from '../../common';
import config from '../../../config.json';

export interface IProviderRegistry {
  cosmos: any;
  ibc: any;
  txRegistryType: any;
  seiprotocol: any;
  aura: any;
}

export async function getProviderRegistry(): Promise<IProviderRegistry> {
  let ibc;
  let cosmos;
  let seiprotocol;
  let aura;
  let txRegistryType;
  switch (config.chainId) {
    case chainIdConfigOnServer.Atlantic2:
      ({ ibc, cosmos, seiprotocol } = await import(
        '@horoscope-v2/sei-js-proto'
      ));
      txRegistryType = seiTxRegistryType;
      break;
    case chainIdConfigOnServer.Euphoria:
    case chainIdConfigOnServer.SerenityTestnet001:
    case chainIdConfigOnServer.AuraTestnet2:
    case chainIdConfigOnServer.Xstaxy1:
    default:
      ({ ibc, cosmos, aura } = await import('@aura-nw/aurajs'));
      txRegistryType = auraTxRegistryType;
      break;
  }
  return {
    cosmos,
    ibc,
    txRegistryType,
    seiprotocol,
    aura,
  };
}

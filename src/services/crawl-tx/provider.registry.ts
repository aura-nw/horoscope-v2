import seiTxRegistryType from './registry-type/sei-network.json' assert { type: 'json' };
import auraTxRegistryType from './registry-type/aura-network.json' assert { type: 'json' };
import { chainIdConfigOnServer } from '../../common';
import config from '../../../config.json' assert { type: 'json' };

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

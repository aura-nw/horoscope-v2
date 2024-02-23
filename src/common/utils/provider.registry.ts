import seiTxRegistryType from '../../services/crawl-tx/registry-type/sei-network.json' assert { type: 'json' };
import auraTxRegistryType from '../../services/crawl-tx/registry-type/aura-network.json' assert { type: 'json' };
import evmosTxRegistryType from '../../services/crawl-tx/registry-type/evmos-network.json' assert { type: 'json' };
import { chainIdConfigOnServer } from '../index';
import config from '../../../config.json' assert { type: 'json' };

export interface IProviderRegistry {
  cosmos: any;
  ethermint: any;
  ibc: any;
  txRegistryType: any;
  seiprotocol: any;
  aura: any;
  evmos: any;
}

export async function getProviderRegistry(): Promise<IProviderRegistry> {
  let ibc;
  let ethermint;
  let cosmos;
  let seiprotocol;
  let aura;
  let evmos;
  let txRegistryType;
  switch (config.chainId) {
    case chainIdConfigOnServer.Atlantic2:
    case chainIdConfigOnServer.Pacific1:
      ({ ibc, cosmos, seiprotocol } = await import(
        '@horoscope-v2/sei-js-proto'
      ));
      txRegistryType = seiTxRegistryType;
      break;
    case chainIdConfigOnServer.Evmos90004:
      ({ ethermint, cosmos, evmos } = await import(
        '@horoscope-v2/evmos-proto'
      ));
      ({ ibc } = await import('@aura-nw/aurajs'));
      txRegistryType = evmosTxRegistryType;
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
    ethermint,
    evmos,
    cosmos,
    ibc,
    txRegistryType,
    seiprotocol,
    aura,
  };
}

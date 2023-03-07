import { URL_TYPE_CONSTANTS } from '../common/constant';

import LIST_NETWORK_FILE from '../../network.json' assert { type: 'json' };

export default class Utils {
  public static LIST_NETWORK = LIST_NETWORK_FILE;

  public static getUrlByChainIdAndType(chainId: string, typeUrl: string) {
    const chain = this.LIST_NETWORK.find((chainItem) => chainItem.chainId === chainId);
    if (chain) {
      switch (typeUrl) {
        case URL_TYPE_CONSTANTS.LCD:
          return chain.LCD;
        case URL_TYPE_CONSTANTS.RPC:
          return chain.RPC;
        default:
          return null;
      }
    }
    return null;
  }
}

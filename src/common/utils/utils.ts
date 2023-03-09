import { URL_TYPE_CONSTANTS } from '../constant';
import LIST_NETWORK from '../../../network.json' assert { type: 'json' };

export default class Utils {
  public static getUrlByChainIdAndType(chainId: string, typeUrl: string) {
    const chain = LIST_NETWORK.find(
      (chainItem) => chainItem.chainId === chainId
    );
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

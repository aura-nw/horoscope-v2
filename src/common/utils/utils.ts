// import { URL_TYPE_CONSTANTS } from '../constant';
// import LIST_NETWORK from '../../../network.json' assert { type: 'json' };

import { fromBech32 } from '@cosmjs/encoding';

export default class Utils {
  // public static getUrlByChainIdAndType(chainId: string, typeUrl: string) {
  //   const chain = LIST_NETWORK.find(
  //     (chainItem) => chainItem.chainId === chainId
  //   );
  //   if (chain) {
  //     switch (typeUrl) {
  //       case URL_TYPE_CONSTANTS.LCD:
  //         return chain.LCD;
  //       case URL_TYPE_CONSTANTS.RPC:
  //         return chain.RPC;
  //       default:
  //         return null;
  //     }
  //   }
  //   return null;
  // }

  public static isValidAddress(address: string, length = -1) {
    try {
      const decodeResult = fromBech32(address);
      if (length === -1) {
        return true;
      }
      if (decodeResult.data.length === length) {
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  public static _onlyUnique(value: any, index: any, self: any) {
    return self.indexOf(value) === index;
  }
}

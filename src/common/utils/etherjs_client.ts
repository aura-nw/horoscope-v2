import { ethers } from 'ethers';
import { PublicClient, createPublicClient, http } from 'viem';
import networks from '../../../network.json' assert { type: 'json' };
import config from '../../../config.json' assert { type: 'json' };

export default class EtherJsClient {
  public etherJsClient: ethers.AbstractProvider;

  constructor() {
    const selectedChain = networks.find(
      (network) => network.chainId === config.chainId
    );
    if (selectedChain?.EVMJSONRPC) {
      this.etherJsClient = ethers.getDefaultProvider(
        selectedChain.EVMJSONRPC[0]
      );
    } else {
      throw new Error(`EVMJSONRPC not found with chainId: ${config.chainId}`);
    }
  }

  public static getViemClient(): PublicClient {
    const selectedChain = networks.find(
      (network) => network.chainId === config.chainId
    );
    if (!selectedChain?.EVMJSONRPC) {
      throw new Error(`EVMJSONRPC not found with chainId: ${config.chainId}`);
    }
    return createPublicClient({
      batch: {
        multicall: true,
      },
      transport: http(selectedChain.EVMJSONRPC[0]),
    });
  }
}

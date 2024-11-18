import { PublicClient, createPublicClient, http } from 'viem';
import { ancient8, publicActionsL1 } from 'viem/op-stack';
import { ancient8Sepolia, mainnet, sepolia } from 'viem/chains';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import networks from '../../../network.json' assert { type: 'json' };

const viemClientMapping: Map<string, any> = new Map();
export function getViemClient(chainId?: string): PublicClient {
  if (!viemClientMapping.has(chainId ?? config.chainId)) {
    const selectedChain = networks.find(
      (network) => network.chainId === (chainId ?? config.chainId)
    );
    if (!selectedChain?.EVMJSONRPC) {
      throw new Error(`EVMJSONRPC not found with chainId: ${config.chainId}`);
    }
    const viemClient = createPublicClient({
      chain: getViemChainById(selectedChain.EVMchainId),
      batch: {
        multicall: {
          batchSize: config.viemConfig.multicall.batchSize,
          wait: config.viemConfig.multicall.waitMilisecond,
        },
      },
      transport: http(selectedChain.EVMJSONRPC[0], {
        batch: {
          batchSize: config.viemConfig.transport.batchSize,
          wait: config.viemConfig.transport.waitMilisecond,
        },
        timeout: config.viemConfig.transport.timeout,
        retryCount: 10,
        retryDelay: 1000,
      }),
    }).extend(publicActionsL1());
    viemClientMapping.set(chainId ?? config.chainId, viemClient);
  }
  return viemClientMapping.get(chainId ?? config.chainId);
}

export function getViemChainById(evmChainId: number | undefined) {
  if (evmChainId === mainnet.id) {
    return mainnet;
  }
  if (evmChainId === sepolia.id) {
    return sepolia;
  }
  if (evmChainId === ancient8.id) {
    return ancient8;
  }
  if (evmChainId === ancient8Sepolia.id) {
    return ancient8Sepolia;
  }
  return undefined;
}

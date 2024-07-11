import { PublicClient, createPublicClient, http, Chain } from 'viem';
import { publicActionsL1 } from 'viem/op-stack';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import networks from '../../../network.json' assert { type: 'json' };

const viemClientMapping: Map<string, PublicClient> = new Map();
export function getViemClient(chainId?: string, chain?: Chain): PublicClient {
  if (!viemClientMapping.has(chainId ?? config.chainId)) {
    const selectedChain = networks.find(
      (network) => network.chainId === (chainId ?? config.chainId)
    );
    if (!selectedChain?.EVMJSONRPC) {
      throw new Error(`EVMJSONRPC not found with chainId: ${config.chainId}`);
    }
    const viemClient = createPublicClient({
      chain,
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
      }),
    }).extend(publicActionsL1());
    viemClientMapping.set(chainId ?? config.chainId, viemClient);
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return viemClientMapping.get(chainId ?? config.chainId);
}

import { LoggerInstance } from 'moleculer';
// eslint-disable-next-line import/no-cycle
import AuraRegistry from '../../services/crawl-tx/aura.registry';
import SeiRegistry from '../../services/crawl-tx/sei.registry';
// import { TimeoutError } from '@cosmjs/stargate';
// const utils_1 = require('@cosmjs/utils');
import config from '../../../config.json' assert { type: 'json' };

export function sleep(ms: number) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((r) => setTimeout(r, ms));
}

export function getRegistryByConfigChainId(
  logger: LoggerInstance
): SeiRegistry | AuraRegistry {
  switch (config.chainId) {
    case 'euphoria-2':
    case 'serenity-testnet-001':
    case 'aura-testnet-2':
    case 'xstaxy-1':
      return new AuraRegistry(logger);
    case 'atlantic-2':
      return new SeiRegistry(logger);
    default:
      return new AuraRegistry(logger);
  }
}

// export function pollForTx(
//   handler: any,
//   timeoutMs = 60000,
//   pollIntervalMs = 3000
// ) {
//   let a;
//   let timedOut = false;
//   const txPollTimeout = setTimeout(() => {
//     timedOut = true;
//   }, timeoutMs);
//   const pollForTx = async (txId: any) => {
//     if (timedOut) {
//       throw new TimeoutError(
//         `Transaction with ID ${txId} was submitted but was not yet found on the chain. You might want to check later. There was a wait of ${
//           timeoutMs / 1000
//         } seconds.`,
//         txId
//       );
//     }
//     await (0, utils_1.sleep)(pollIntervalMs);
//     const result = await this.getTx(txId);
//     return result
//       ? {
//           code: result.code,
//           height: result.height,
//           events: result.events,
//           rawLog: result.rawLog,
//           transactionHash: txId,
//           gasUsed: result.gasUsed,
//           gasWanted: result.gasWanted,
//         }
//       : pollForTx(txId);
//   };
// }

// import { TimeoutError } from '@cosmjs/stargate';

// const utils_1 = require('@cosmjs/utils');

export function sleep(ms: number) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((r) => setTimeout(r, ms));
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

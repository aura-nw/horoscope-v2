import {
  calculateFee,
  GasPrice,
  SigningStargateClientOptions,
} from '@cosmjs/stargate';

export const defaultSigningClientOptions: SigningStargateClientOptions = {
  broadcastPollIntervalMs: 300,
  broadcastTimeoutMs: 8_000,
  gasPrice: GasPrice.fromString('0.1uaura'),
};
export const defaultGasPrice = GasPrice.fromString('0.1uaura');
export const defaultSendFee = calculateFee(5_000_000, defaultGasPrice);

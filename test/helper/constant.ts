import {
  calculateFee,
  GasPrice,
  SigningStargateClientOptions,
} from '@cosmjs/stargate';

export const defaultSigningClientOptions: SigningStargateClientOptions = {
  broadcastPollIntervalMs: 300,
  broadcastTimeoutMs: 8_000,
  gasPrice: GasPrice.fromString('0.05uaura'),
};
export const defaultGasPrice = GasPrice.fromString('0.05uaura');
export const defaultSendFee = calculateFee(200_000, defaultGasPrice);

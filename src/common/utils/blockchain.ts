import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice, SigningStargateClient } from '@cosmjs/stargate';
import ConfigClass from '../config';
import network from '../network';

const mnemonic =
  process.env.MNEMONIC ||
  'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius';
const configClass = new ConfigClass();
export async function getClient(): Promise<SigningStargateClient> {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'aura',
  });
  const { rpcEndpoint } = network[configClass.NODE_ENV];
  const clientOptions = {
    gasPrice: GasPrice.fromString('1uaura'),
  };
  const client = await SigningStargateClient.connectWithSigner(
    rpcEndpoint,
    wallet,
    clientOptions
  );
  return client;
}

export async function getAccounts() {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'aura',
  });

  return wallet.getAccounts();
}

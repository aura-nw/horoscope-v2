import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice, SigningStargateClient } from '@cosmjs/stargate';
import ConfigClass from '../config';
import network from '../network';

const mnemonic =
  'affair forest north decade one empty trend sauce harsh market trumpet middle rally task tooth valid amused stove roast oven guitar diary vital immune';
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

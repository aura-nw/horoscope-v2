import { Config } from '.';
import Network from '../../network.json';

export const testNetwork = {
  chainId: 'aura-testnet-2',
  RPC: ['https://rpc.dev.aura.network'],
  LCD: ['https://lcd.dev.aura.network'],
  databaseName: 'horoscope_dev_auratestnet1',
};

const network = Network.find((item) => item.chainId === Config.CHAIN_ID);

export default network || testNetwork;

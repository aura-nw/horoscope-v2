/* eslint-disable import/no-extraneous-dependencies */
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import network from '../../../network.json';
import config from '../../../config.json';

export default class CosmjsClient {
  public httpBatchClient: HttpBatchClient;

  public lcdClient: any;

  public constructor() {
    const rpc =
      network.find((net: any) => net.chainId === config.chainId)?.RPC[0] || '';
    this.httpBatchClient = new HttpBatchClient(rpc);
  }
}

const client = new CosmjsClient();

export function getHttpBatchClient(): HttpBatchClient {
  return client.httpBatchClient;
}

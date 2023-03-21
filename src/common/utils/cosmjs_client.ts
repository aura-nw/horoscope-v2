/* eslint-disable import/no-extraneous-dependencies */
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { Config } from '..';

export default class CosmjsClient {
  public httpBatchClient: HttpBatchClient;

  public lcdClient: any;

  public constructor() {
    this.httpBatchClient = new HttpBatchClient(Config.RPC_ENDPOINT);
  }
}

const client = new CosmjsClient();

export function getHttpBatchClient(): HttpBatchClient {
  return client.httpBatchClient;
}

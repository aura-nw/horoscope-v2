import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { Config } from '..';

export default class CosmjsClient {
  public httpBatchClient: HttpBatchClient;

  public constructor() {
    this.httpBatchClient = new HttpBatchClient(Config.RPC_ENDPOINT);
  }
}

const client = new CosmjsClient();

export function getHttpBatchClient(): HttpBatchClient {
  return client.httpBatchClient;
}

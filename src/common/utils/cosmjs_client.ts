import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { Config } from '..';

export default class CosmjsClient {
  public httpBatchClient: any;
}

const client = new CosmjsClient();

export function getHttpBatchClient(): HttpBatchClient {
  if (!client.httpBatchClient) {
    client.httpBatchClient = new HttpBatchClient(Config.RPC_ENDPOINT);
  }
  return client.httpBatchClient;
}

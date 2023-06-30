/* eslint-disable import/no-extraneous-dependencies */
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import network from '../../../network.json' assert { type: 'json' };
import config from '../../../config.json' assert { type: 'json' };

export default class CosmjsClient {
  public httpBatchClient: HttpBatchClient;

  public constructor() {
    const rpc =
      network.find((net: any) => net.chainId === config.chainId)?.RPC[0] || '';
    this.httpBatchClient = new HttpBatchClient(rpc, {
      batchSizeLimit: config.httpBatchRequest.batchSizeLimit ?? 20,
      dispatchInterval: config.httpBatchRequest.dispatchMilisecond ?? 20,
    });
  }
}

const client = new CosmjsClient();

export function getHttpBatchClient(): HttpBatchClient {
  return client.httpBatchClient;
}

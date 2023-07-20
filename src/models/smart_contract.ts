/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import {
  QueryContractInfoRequest,
  QueryContractInfoResponse,
  QueryRawContractStateRequest,
  QueryRawContractStateResponse,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/query';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { cosmwasm } from '@aura-nw/aurajs';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { ABCI_QUERY_PATH } from '../common';
import { Code } from './code';
import BaseModel from './base';

export class SmartContract extends BaseModel {
  id!: number;

  name: string | undefined;

  address!: string;

  creator!: string;

  code_id!: number;

  status!: string;

  instantiate_hash!: string;

  instantiate_height!: number;

  version: string | undefined;

  static get tableName() {
    return 'smart_contract';
  }

  static get STATUS() {
    return {
      LATEST: 'LATEST',
      MIGRATED: 'MIGRATED',
    };
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'address',
        'creator',
        'code_id',
        'instantiate_hash',
        'instantiate_height',
      ],
      properties: {
        name: { type: ['string', 'null'] },
        address: { type: 'string' },
        creator: { type: 'string' },
        code_id: { type: 'number' },
        status: { type: 'string' },
        instantiate_hash: { type: 'string' },
        instantiate_height: { type: 'number' },
        version: { type: ['string', 'null'] },
      },
    };
  }

  static get relationMappings() {
    return {
      code: {
        relation: Model.BelongsToOneRelation,
        modelClass: Code,
        join: {
          from: 'smart_contract.code_id',
          to: 'code.code_id',
        },
      },
    };
  }

  static async getContractData(
    addresses: string[],
    _httpBatchClient: HttpBatchClient
  ): Promise<
    [
      (QueryRawContractStateResponse | null)[],
      (QueryContractInfoResponse | null)[]
    ]
  > {
    const contractCw2s = await this.getContractCw2s(
      addresses,
      _httpBatchClient
    );
    const contractInfos = await this.getContractInfos(
      addresses,
      _httpBatchClient
    );

    return [contractCw2s, contractInfos];
  }

  static async getContractInfos(
    addresses: string[],
    _httpBatchClient: HttpBatchClient
  ) {
    const batchQueries: any[] = [];

    addresses.forEach((address) => {
      const requestContractInfo: QueryContractInfoRequest = {
        address,
      };
      const dataContractInfo = toHex(
        cosmwasm.wasm.v1.QueryContractInfoRequest.encode(
          requestContractInfo
        ).finish()
      );

      batchQueries.push(
        _httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.CONTRACT_INFO,
            data: dataContractInfo,
          })
        )
      );
    });

    const results: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);

    const contractInfos: any[] = [];
    for (let i = 0; i < results.length; i += 1) {
      contractInfos.push(
        results[i].result.response.value
          ? cosmwasm.wasm.v1.QueryContractInfoResponse.decode(
              fromBase64(results[i].result.response.value)
            )
          : null
      );
    }

    return contractInfos;
  }

  static async getContractCw2s(
    addresses: string[],
    _httpBatchClient: HttpBatchClient
  ) {
    const batchQueries: any[] = [];

    addresses.forEach((address) => {
      const requestCw2: QueryRawContractStateRequest = {
        address,
        queryData: fromBase64('Y29udHJhY3RfaW5mbw=='), // contract_info
      };
      const dataCw2 = toHex(
        cosmwasm.wasm.v1.QueryRawContractStateRequest.encode(
          requestCw2
        ).finish()
      );

      batchQueries.push(
        _httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.RAW_CONTRACT_STATE,
            data: dataCw2,
          })
        )
      );
    });

    const results: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);

    const contractCw2s: any[] = [];
    for (let i = 0; i < results.length; i += 1) {
      contractCw2s.push(
        results[i].result.response.value
          ? cosmwasm.wasm.v1.QueryRawContractStateResponse.decode(
              fromBase64(results[i].result.response.value)
            )
          : null
      );
    }

    return contractCw2s;
  }
}

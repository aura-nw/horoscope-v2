import { cosmwasm } from '@aura-nw/aurajs';
import { fromBase64, fromUtf8, toHex, toUtf8 } from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { Model } from 'objection';
import { getHttpBatchClient } from '../common';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Token from './cw721_token';
// eslint-disable-next-line import/no-cycle
import CW721Activity from './cw721_tx';
import { SmartContract } from './smart_contract';

export interface IContractInfoAndMinter {
  address: string;
  name?: string;
  symbol?: string;
  minter?: string;
}
export default class CW721Contract extends BaseModel {
  [relation: string]: any;

  contract_id!: number;

  symbol?: string;

  minter?: string;

  id!: number;

  name?: string;

  track?: boolean;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw721_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['contract_id'],
      properties: {
        contract_id: { type: 'number' },
        minter: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      tokens: {
        relation: Model.HasManyRelation,
        modelClass: CW721Token,
        join: {
          from: 'cw721_contract.id',
          to: 'cw721_token.cw721_contract_id',
        },
      },
      activities: {
        relation: Model.HasManyRelation,
        modelClass: CW721Activity,
        join: {
          from: 'cw721_contract.id',
          to: 'cw721_activity.cw721_contract_id',
        },
      },
      smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContract,
        join: {
          from: 'cw721_contract.contract_id',
          to: 'smart_contract.id',
        },
      },
    };
  }

  static async getContractsInfo(
    contractAddresses: string[]
  ): Promise<IContractInfoAndMinter[]> {
    const httpBatchClient = getHttpBatchClient();
    const promisesInfo: any[] = [];
    const promisesMinter: any[] = [];
    contractAddresses.forEach((address: string) => {
      promisesInfo.push(
        httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                queryData: toUtf8('{"contract_info":{}}'),
              }).finish()
            ),
          })
        )
      );
    });
    contractAddresses.forEach((address: string) => {
      promisesMinter.push(
        httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                queryData: toUtf8('{"minter":{}}'),
              }).finish()
            ),
          })
        )
      );
    });
    const contractsInfo: IContractInfoAndMinter[] = [];
    const resultsContractsInfo: JsonRpcSuccessResponse[] = await Promise.all(
      promisesInfo
    );
    const resultsMinters: JsonRpcSuccessResponse[] = await Promise.all(
      promisesMinter
    );
    for (let index = 0; index < resultsContractsInfo.length; index += 1) {
      let contractInfo;
      let minter;
      try {
        contractInfo = JSON.parse(
          fromUtf8(
            cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
              fromBase64(resultsContractsInfo[index].result.response.value)
            ).data
          )
        );
      } catch (error) {
        if (!(error instanceof SyntaxError) && !(error instanceof TypeError)) {
          throw error;
        }
      }
      try {
        minter = JSON.parse(
          fromUtf8(
            cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
              fromBase64(resultsMinters[index].result.response.value)
            ).data
          )
        ).minter;
      } catch (error) {
        if (!(error instanceof SyntaxError) && !(error instanceof TypeError)) {
          throw error;
        }
      }
      contractsInfo.push({
        address: contractAddresses[index],
        name: contractInfo?.name,
        symbol: contractInfo?.symbol,
        minter,
      });
    }
    return contractsInfo;
  }
}

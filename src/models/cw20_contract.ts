import { Model } from 'objection';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { fromBase64, fromUtf8, toHex, toUtf8 } from '@cosmjs/encoding';
import { cosmwasm } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { CW20Holder } from './cw20_holder';
// eslint-disable-next-line import/no-cycle
import { Cw20Event } from './cw20_activity';
import { SmartContract } from './smart_contract';
import { getHttpBatchClient } from '../common';

export interface IHolderEvent {
  address: string;
  amount: string;
  contract_address: string;
  event_height: number;
}
export interface IContractInfo {
  address: string;
  symbol?: string;
  minter?: string;
  decimal?: string;
  marketing_info?: any;
  name?: string;
}
export class Cw20Contract extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  id!: number;

  smart_contract_id!: number;

  marketing_info?: any;

  total_supply!: string;

  symbol?: string;

  decimal?: string;

  minter?: string;

  name?: string;

  track!: boolean;

  last_updated_height!: number;

  smart_contract_address!: string;

  static get tableName() {
    return 'cw20_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['smart_contract_id', 'total_supply'],
      properties: {
        total_supply: { type: 'string' },
        asset_info: { type: 'object' },
        smart_contract_id: { type: 'number' },
        marketing_info: { type: 'object' },
        name: { type: 'string' },
      },
    };
  }

  // get instantiate balances
  static async getInstantiateBalances(
    contractAddress: string
  ): Promise<IHolderEvent[]> {
    const httpBatchClient = getHttpBatchClient();
    const holders: IHolderEvent[] = [];
    // get all owners of cw20 contract
    let startAfter = null;
    do {
      let query = '{"all_accounts":{}}';
      if (startAfter) {
        query = `{"all_accounts":{"start_after":"${startAfter}"}}`;
      }
      // eslint-disable-next-line no-await-in-loop
      const result = await httpBatchClient.execute(
        createJsonRpcRequest('abci_query', {
          path: '/cosmwasm.wasm.v1.Query/SmartContractState',
          data: toHex(
            cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
              address: contractAddress,
              queryData: toUtf8(query),
            }).finish()
          ),
        })
      );
      const { accounts } = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(result.result.response.value)
          ).data
        )
      );
      if (accounts.length > 0) {
        accounts.forEach((account: string) => {
          holders.push({
            address: account,
            amount: '',
            contract_address: contractAddress,
            event_height: 0,
          });
        });
        startAfter = accounts[accounts.length - 1];
      } else {
        startAfter = null;
      }
    } while (startAfter);
    const promiseBalanceHolders: any[] = [];
    holders.forEach((holder) => {
      promiseBalanceHolders.push(
        httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address: contractAddress,
                queryData: toUtf8(
                  `{"balance":{"address":"${holder.address}"}}`
                ),
              }).finish()
            ),
          })
        )
      );
    });
    const result: JsonRpcSuccessResponse[] = await Promise.all(
      promiseBalanceHolders
    );
    holders.forEach((holder, index) => {
      const { balance }: { balance: string } = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(result[index].result.response.value)
          ).data
        )
      );
      // eslint-disable-next-line no-param-reassign
      holder.amount = balance;
      // eslint-disable-next-line no-param-reassign
      holder.event_height = parseInt(result[index].result.response.height, 10);
    });
    return holders;
  }

  // get contract info (minter, symbol, decimal, marketing_info) by query rpc
  static async getContractsInfo(
    contractAddresses: string[]
  ): Promise<IContractInfo[]> {
    const httpBatchClient = getHttpBatchClient();
    const promisesInfo: any[] = [];
    const promisesMinter: any[] = [];
    const promisesMarketingInfo: any[] = [];
    contractAddresses.forEach((address: string) => {
      promisesInfo.push(
        httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                queryData: toUtf8('{"token_info":{}}'),
              }).finish()
            ),
          })
        )
      );
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
      promisesMarketingInfo.push(
        httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                queryData: toUtf8('{"marketing_info":{}}'),
              }).finish()
            ),
          })
        )
      );
    });
    const contractsInfo: IContractInfo[] = [];
    const resultsContractsInfo: JsonRpcSuccessResponse[] = await Promise.all(
      promisesInfo
    );
    const resultsMinters: JsonRpcSuccessResponse[] = await Promise.all(
      promisesMinter
    );
    const resultsMarketingInfo: JsonRpcSuccessResponse[] = await Promise.all(
      promisesMarketingInfo
    );
    for (let index = 0; index < resultsContractsInfo.length; index += 1) {
      let minter;
      let contractInfo;
      let marketingInfo;
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
      try {
        marketingInfo = JSON.parse(
          fromUtf8(
            cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
              fromBase64(resultsMarketingInfo[index].result.response.value)
            ).data
          )
        );
      } catch (error) {
        if (!(error instanceof SyntaxError) && !(error instanceof TypeError)) {
          throw error;
        }
      }
      contractsInfo.push({
        address: contractAddresses[index],
        symbol: contractInfo?.symbol,
        minter,
        decimal: contractInfo?.decimals,
        marketing_info: marketingInfo,
        name: contractInfo?.name,
      });
    }
    return contractsInfo;
  }

  static get relationMappings() {
    return {
      smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContract,
        join: {
          to: 'smart_contract.id',
          from: 'cw20_contract.smart_contract_id',
        },
      },
      holders: {
        relation: Model.HasManyRelation,
        modelClass: CW20Holder,
        join: {
          from: 'cw20_contract.id',
          to: 'cw20_holder.cw20_contract_id',
        },
      },
      events: {
        relation: Model.HasManyRelation,
        modelClass: Cw20Event,
        join: {
          from: 'cw20_contract.id',
          to: 'cw20_event.cw20_contract_id',
        },
      },
    };
  }
}

import { cosmwasm } from '@aura-nw/aurajs';
import {
  fromBase64,
  fromUtf8,
  toBase64,
  toHex,
  toUtf8,
} from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import CW721Contract from '../../models/cw721_contract';
import CW721Token from '../../models/cw721_token';
import CW721Tx from '../../models/cw721_tx';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { getHttpBatchClient } from '../../common/utils/cosmjs_client';
import { BULL_JOB_NAME, SERVICE, SERVICE_NAME } from '../../common';

interface IContractInfoAndMinter {
  name: string;
  symbol: string;
  minter: string;
}

@Service({
  name: SERVICE_NAME.CW721,
  version: 1,
})
export default class CW721AssetService extends BullableService {
  private _httpBatchClient: HttpBatchClient;

  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  // confirmed
  @QueueHandler({
    queueName: BULL_JOB_NAME.ENRICH_CW721,
    jobType: BULL_JOB_NAME.ENRICH_CW721,
    prefix: 'horoscope_',
  })
  async jobHandlerEnrichCw721(_payload: {
    address: string;
    codeId: string;
    txData: {
      txhash: string;
      sender: string;
      action: string;
    };
  }): Promise<void> {
    const { address, codeId, txData } = _payload;
    const listTokens = await this._getTokenList(address);
    const tokens: CW721Token[] = await this._getTokensInfo(address, listTokens);
    const contractInfoAndMinter = await this._getContractInfoAndMinter(address);
    const contractFound = await CW721Contract.query()
      .where('address', address)
      .first();
    const contract: CW721Contract = CW721Contract.fromJson({
      code_id: codeId,
      address,
      name: contractInfoAndMinter.name,
      symbol: contractInfoAndMinter.symbol,
      minter: contractInfoAndMinter.minter,
    });
    const tx: CW721Tx = CW721Tx.fromJson({
      action: txData.action,
      sender: txData.sender,
      txhash: txData.txhash,
      contract_address: address,
    });
    const cw721ContractGraph = {
      ...contract,
      tokens: tokens.map((token) => CW721Token.fromJson(token)),
    };
    if (contractFound) {
      cw721ContractGraph.id = contractFound.id;
      await CW721Contract.query().upsertGraph(cw721ContractGraph);
    } else {
      await CW721Contract.query().insertGraph(cw721ContractGraph);
    }
    await CW721Tx.query().insert(tx);
  }

  @Action({
    name: SERVICE.V1.Cw721.EnrichCw721.key,
  })
  async enrichCw721(
    ctx: Context<{
      address: string;
      codeId: string;
      txData: {
        txhash: string;
        sender: string;
        action: string;
      };
    }>
  ) {
    this.createJob(BULL_JOB_NAME.ENRICH_CW721, BULL_JOB_NAME.ENRICH_CW721, {
      address: ctx.params.address,
      codeId: ctx.params.codeId,
      txData: ctx.params.txData,
    });
  }

  // confirmed
  async _getTokenList(address: string) {
    try {
      let doneLoop = false;
      const listTokenId: string[] = [];
      let queryData = toBase64(toUtf8('{"all_tokens":{"limit":100}}'));
      while (!doneLoop) {
        const resultCallApi =
          // eslint-disable-next-line no-await-in-loop
          await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.smartContractState({
            address,
            queryData,
          });
        if (
          resultCallApi?.data?.tokens &&
          resultCallApi.data.tokens.length > 0
        ) {
          listTokenId.push(...resultCallApi.data.tokens);
          const lastTokenId =
            resultCallApi.data.tokens[resultCallApi.data.tokens.length - 1];
          queryData = toBase64(
            toUtf8(
              `{"all_tokens":{"limit":100, "start_after":"${lastTokenId}"}}`
            )
          );
        } else {
          doneLoop = true;
        }
      }
      return listTokenId;
    } catch (error) {
      throw new Error(`_getTokenList error ${error}`);
    }
  }

  // confirmed
  async _getTokensInfo(address: string, tokenIdList: string[]) {
    try {
      const result: CW721Token[] = [];
      const listPromise: any[] = [];
      tokenIdList.forEach((tokenId) => {
        const queryData = toBase64(
          toUtf8(`{"all_nft_info":{"token_id":"${tokenId}"}}`)
        );

        listPromise.push(
          this._httpBatchClient.execute(
            createJsonRpcRequest('abci_query', {
              path: '/cosmwasm.wasm.v1.Query/SmartContractState',
              data: toHex(
                cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                  address,
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  queryData,
                }).finish()
              ),
            })
          )
        );
      });

      const resultListPromise: JsonRpcSuccessResponse[] = await Promise.all(
        listPromise
      );

      tokenIdList.forEach((tokenId, index) => {
        const data = JSON.parse(
          fromUtf8(
            fromBase64(
              resultListPromise[index].result.response.value.substring(4)
            )
          )
        );
        result.push(
          CW721Token.fromJson({
            token_id: tokenId,
            token_uri: data.info.token_uri,
            extension: data.info.extension,
            owner: data.access.owner,
            contract_address: address,
          })
        );
      });
      return result;
    } catch (error) {
      throw new Error(`CW721 _getTokenInfo error ${error}`);
    }
  }

  // confirmed
  async getTokenInfo(address: string, tokenId: string): Promise<CW721Token> {
    const result =
      await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.smartContractState({
        address,
        queryData: toBase64(
          toUtf8(`{"all_nft_info":{"token_id":"${tokenId}"}}`)
        ),
      });
    return CW721Token.fromJson({
      token_id: tokenId,
      token_uri: result.info.token_uri,
      extension: result.info.extension,
      owner: result.access.owner,
      contract_address: address,
    });
  }

  // confirmed
  async _getContractInfoAndMinter(
    address: string
  ): Promise<IContractInfoAndMinter> {
    const contractInfo =
      await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.smartContractState({
        address,
        queryData: toBase64(toUtf8('{"contract_info":{}}')),
      });
    const minter =
      await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.smartContractState({
        address,
        queryData: toBase64(toUtf8('{"minter":{}}')),
      });

    return {
      name: contractInfo.data.name as string,
      symbol: contractInfo.data.symbol as string,
      minter: minter.data.minter as string,
    };
  }

  public async _start(): Promise<void> {
    this._lcdClient = await getLcdClient();
    return super._start();
  }
}

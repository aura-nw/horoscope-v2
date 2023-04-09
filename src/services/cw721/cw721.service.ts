/* eslint-disable no-await-in-loop */
import { cosmwasm } from '@aura-nw/aurajs';
import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/tx';
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
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import CW721Contract from '../../models/cw721_contract';
import CW721Tx from '../../models/cw721_tx';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config, getHttpBatchClient } from '../../common';
import {
  BLOCK_CHECKPOINT_JOB_NAME,
  BULL_JOB_NAME,
  CW721_ACTION,
  EVENT_TYPE,
  MSG_TYPE,
  SERVICE_NAME,
} from '../../common/constant';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { BlockCheckpoint, Transaction, TransactionMessage } from '../../models';
import Codeid from '../../models/codeid';
import CW721Token from '../../models/cw721_token';
import config from '../../../config.json' assert { type: 'json' };

const { NODE_ENV } = Config;

interface IContractInfoAndMinter {
  name: string;
  symbol: string;
  minter: string;
}

interface IContractMsgInfo {
  sender: string;
  contractAddress: string;
  action: string;
  txhash: string;
  tokenid?: string;
  codeid?: string;
  contractType?: string;
}

interface ITokenInfo {
  token_uri: string;
  extension: any;
  owner: string;
}

@Service({
  name: SERVICE_NAME.CW721,
  version: 1,
})
export default class Cw721HandlerService extends BullableService {
  _httpBatchClient: HttpBatchClient;

  _currentAssetHandlerTx = 1;

  _lcdClient: any;

  _assetTxBatch: number = config.cw721.assetTxBatch
    ? config.cw721.assetTxBatch
    : 100;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  // checked + tested
  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
    jobType: BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
  })
  async jobHandlerCw721Transfer(
    listTransfer: IContractMsgInfo[]
  ): Promise<void> {
    const batchUpdateTransfer: any[] = [];
    const resultListTokenInfo: ITokenInfo[] = await this.getTokenInfoForListMsg(
      listTransfer
    );
    listTransfer.forEach((item, index) => {
      if (item.tokenid && resultListTokenInfo[index].owner) {
        batchUpdateTransfer.push(
          CW721Token.query()
            .where('contract_address', item.contractAddress)
            .andWhere('token_id', item.tokenid)
            .patch({
              owner: resultListTokenInfo[index].owner,
            })
        );
      } else {
        throw new Error(
          `Msg transfer in tx ${item.txhash} not found token id transfered or not found new owner`
        );
      }
    });
    await Promise.all(batchUpdateTransfer);
  }

  // checked + tested
  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_MINT,
    jobType: BULL_JOB_NAME.HANDLE_CW721_MINT,
  })
  async jobHandlerCw721Mint(listMint: IContractMsgInfo[]): Promise<void> {
    const resultListTokenInfo: ITokenInfo[] = await this.getTokenInfoForListMsg(
      listMint
    );
    await CW721Token.query().insert(
      listMint.map((mintMsg, index) =>
        CW721Token.fromJson({
          token_id: mintMsg.tokenid,
          token_uri: resultListTokenInfo[index].token_uri,
          extension: resultListTokenInfo[index].extension,
          owner: resultListTokenInfo[index].owner,
          contract_address: mintMsg.contractAddress,
        })
      )
    );
  }

  // checked + tested
  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_BURN,
    jobType: BULL_JOB_NAME.HANDLE_CW721_BURN,
  })
  async jobHandlerCw721Burn(listBurn: IContractMsgInfo[]): Promise<void> {
    const batchUpdateBurn: any[] = [];
    listBurn.forEach((item) => {
      if (item.tokenid) {
        batchUpdateBurn.push(
          CW721Token.query()
            .where('contract_address', item.contractAddress)
            .andWhere('token_id', item.tokenid)
            .delete()
        );
      } else {
        throw new Error(
          `Msg burn in tx ${item.txhash} not found token id burned`
        );
      }
    });
    await Promise.all(batchUpdateBurn);
  }

  // checked
  @QueueHandler({
    queueName: BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
    jobType: BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
  })
  async jobHandler(): Promise<void> {
    await this.handleJob();
  }

  // checked
  async _start(): Promise<void> {
    this._lcdClient = await getLcdClient();
    if (NODE_ENV !== 'test') {
      await this.initEnv();
      this.createJob(
        BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
        BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.cw721.assetMillisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }

  async handleJob() {
    // get range txs for proccessing
    const startTxId: number = this._currentAssetHandlerTx;
    const listTx: Transaction[] = await Transaction.query()
      .where('id', '>=', startTxId)
      .orderBy('id', 'ASC')
      .limit(this._assetTxBatch);
    this.logger.info(
      `startTxId: ${startTxId} to endTxId: ${listTx[listTx.length - 1].id}`
    );
    if (listTx.length > 0) {
      try {
        // get all contract Msg in above range txs
        const listContractMsg = await this.getContractMsgs(
          startTxId,
          listTx[listTx.length - 1].id
        );
        if (listContractMsg.length > 0) {
          // set codeid and contract type for all contracts in list
          await this.setCodeIdForEachContractInList(listContractMsg);
          await this.setTypeForEachContractInList(listContractMsg);
          // insert new cw721 txs
          const cw721Txs = listContractMsg
            .filter((msg) => msg.contractType === 'CW721')
            .map((cw721Msg) =>
              CW721Tx.fromJson({
                action: cw721Msg.action,
                sender: cw721Msg.sender,
                txhash: cw721Msg.txhash,
                contract_address: cw721Msg.contractAddress,
              })
            );
          await CW721Tx.query().insert(cw721Txs);
          // handle instantiate cw721 contracts
          await this.handleInstantiateMsgs(listContractMsg);
          // handle all cw721 execute messages
          const cw721MsgsExec = listContractMsg.filter(
            (msg) =>
              msg.contractType === 'CW721' &&
              msg.action !== CW721_ACTION.INSTANTIATE
          );
          this.handleCw721MsgExec(cw721MsgsExec);
        }
        await BlockCheckpoint.query()
          .patch({
            height: listTx[listTx.length - 1].id + 1,
          })
          .where('job_name', BLOCK_CHECKPOINT_JOB_NAME.CW721_HANDLER);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  // checked
  async handleInstantiateMsgs(batchContract: IContractMsgInfo[]) {
    const cw721MsgsInstantiate = batchContract.filter(
      (msg) =>
        msg.contractType === 'CW721' && msg.action === CW721_ACTION.INSTANTIATE
    );
    if (cw721MsgsInstantiate.length > 0) {
      const batchContractInfoAndMinter =
        await this.getContractInfoAndMinterForBatchContract(
          cw721MsgsInstantiate.map((contract) => contract.contractAddress)
        );

      const instantiateContracts = cw721MsgsInstantiate.map((contract, index) =>
        CW721Contract.fromJson({
          code_id: contract.codeid,
          address: contract.contractAddress,
          name: batchContractInfoAndMinter[index].name,
          symbol: batchContractInfoAndMinter[index].symbol,
          minter: batchContractInfoAndMinter[index].minter,
        })
      );
      await CW721Contract.query().insert(instantiateContracts);
    }
  }

  // checked
  handleCw721MsgExec(cw721MsgsExec: IContractMsgInfo[]) {
    const listTransfer = cw721MsgsExec.filter(
      (item) => item.action === CW721_ACTION.TRANSFER
    );
    const listMint = cw721MsgsExec.filter(
      (item) => item.action === CW721_ACTION.MINT
    );
    const listBurn = cw721MsgsExec.filter(
      (item) => item.action === CW721_ACTION.BURN
    );
    if (listTransfer.length > 0) {
      this.createJob(
        BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
        BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
        listTransfer,
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    }
    if (listBurn.length > 0) {
      this.createJob(
        BULL_JOB_NAME.HANDLE_CW721_BURN,
        BULL_JOB_NAME.HANDLE_CW721_BURN,
        listBurn,
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    }
    if (listMint.length > 0) {
      this.createJob(
        BULL_JOB_NAME.HANDLE_CW721_MINT,
        BULL_JOB_NAME.HANDLE_CW721_MINT,
        listMint,
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    }
  }

  // checked
  async setTypeForEachContractInList(listContractMsg: IContractMsgInfo[]) {
    await Promise.all(
      listContractMsg.map(async (msg) => {
        const type = (
          await Codeid.query()
            .where('codeid', msg.codeid ? msg.codeid : 'unknown')
            .first()
        )?.type;
        return Object.assign(msg, { contractType: type });
      })
    );
    return listContractMsg;
  }

  // checked
  async setCodeIdForEachContractInList(listContractMsg: IContractMsgInfo[]) {
    const listPromise: any[] = [];
    listContractMsg.forEach((e: IContractMsgInfo) => {
      listPromise.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/ContractInfo',
            data: toHex(
              cosmwasm.wasm.v1.QueryContractInfoRequest.encode({
                address: e.contractAddress,
              }).finish()
            ),
          })
        )
      );
    });
    const resultListPromise: JsonRpcSuccessResponse[] = await Promise.all(
      listPromise
    );
    listContractMsg.forEach((item, index) => {
      Object.assign(item, {
        codeid: cosmwasm.wasm.v1.QueryContractInfoResponse.decode(
          fromBase64(resultListPromise[index].result.response.value)
        ).contractInfo?.codeId.toString(),
      });
    });
    return listContractMsg;
  }

  // checked
  async getContractInfoAndMinterForBatchContract(
    addressBatch: string[]
  ): Promise<IContractInfoAndMinter[]> {
    const listPromiseContractInfo: any[] = [];
    const listPromiseMinter: any[] = [];
    addressBatch.forEach((address: string) => {
      listPromiseContractInfo.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                queryData: toBase64(toUtf8('{"contract_info":{}}')),
              }).finish()
            ),
          })
        )
      );
    });
    addressBatch.forEach((address: string) => {
      listPromiseMinter.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                queryData: toBase64(toUtf8('{"minter":{}}')),
              }).finish()
            ),
          })
        )
      );
    });
    const batchContractInfoAndMinter = [];
    const resultListPromiseContractInfo: JsonRpcSuccessResponse[] =
      await Promise.all(listPromiseContractInfo);
    const resultListPromiseMinter: JsonRpcSuccessResponse[] = await Promise.all(
      listPromiseMinter
    );
    for (
      let index = 0;
      index < resultListPromiseContractInfo.length;
      index += 1
    ) {
      const contractInfoResponse = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(
              resultListPromiseContractInfo[index].result.response.value
            )
          ).data
        )
      );
      const minterResponse = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(resultListPromiseMinter[index].result.response.value)
          ).data
        )
      );
      batchContractInfoAndMinter.push({
        name: contractInfoResponse.name as string,
        symbol: contractInfoResponse.symbol as string,
        minter: minterResponse.minter as string,
      });
    }
    return batchContractInfoAndMinter;
  }

  // checked
  async getTokenInfoForListMsg(
    listToken: IContractMsgInfo[]
  ): Promise<ITokenInfo[]> {
    const listPromise: any[] = [];
    listToken.forEach((item: IContractMsgInfo) => {
      if (item.tokenid) {
        listPromise.push(
          this._httpBatchClient.execute(
            createJsonRpcRequest('abci_query', {
              path: '/cosmwasm.wasm.v1.Query/SmartContractState',
              data: toHex(
                cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                  address: item.contractAddress,
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  queryData: toBase64(
                    toUtf8(`{"all_nft_info":{"token_id":"${item.tokenid}"}}`)
                  ),
                }).finish()
              ),
            })
          )
        );
      } else {
        throw new Error(
          `Msg transfer in tx ${item.txhash} not found token id transfered`
        );
      }
    });
    const resultListPromiseTokenInfo: JsonRpcSuccessResponse[] =
      await Promise.all(listPromise);

    return resultListPromiseTokenInfo.map((resultTokenInfo) => {
      const tokenInfoResponse = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(resultTokenInfo.result.response.value)
          ).data
        )
      );
      return {
        token_uri: tokenInfoResponse.info.token_uri,
        extension: tokenInfoResponse.info.extension,
        owner: tokenInfoResponse.access.owner,
      };
    });
  }

  // checked + tested
  async initEnv() {
    // DB -> Config -> MinDB
    // Get handled txs from db
    let TxIdAssetHandler = await BlockCheckpoint.query().findOne({
      job_name: BLOCK_CHECKPOINT_JOB_NAME.CW721_HANDLER,
    });
    if (!TxIdAssetHandler) {
      // min Tx from DB
      const minTxId = await Transaction.query().orderBy('id', 'ASC').first();
      if (!minTxId) {
        throw Error('Transaction table empty');
      }
      TxIdAssetHandler = await BlockCheckpoint.query().insert({
        job_name: BLOCK_CHECKPOINT_JOB_NAME.CW721_HANDLER,
        height: config.cw721.assetStartTxId
          ? config.cw721.assetStartTxId
          : minTxId.id,
      });
    }
    this._currentAssetHandlerTx = TxIdAssetHandler.height;
    this.logger.info(`_currentAssetHandlerTx: ${this._currentAssetHandlerTx}`);
  }

  // checked + tested
  async getContractMsgs(from: number, to: number) {
    const listContractMsgInfo: IContractMsgInfo[] = [];
    // from, from+1, ... to-1
    const listTxs = await Transaction.query()
      .alias('tx')
      .whereBetween('tx.id', [from, to])
      .withGraphJoined('messages')
      .whereIn('messages.type', [
        MSG_TYPE.MSG_EXECUTE_CONTRACT,
        MSG_TYPE.MSG_INSTANTIATE_CONTRACT,
      ]);

    // eslint-disable-next-line no-restricted-syntax
    for (const tx of listTxs) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      tx.messages.forEach((message: TransactionMessage, index: number) => {
        if (message.type === MSG_TYPE.MSG_EXECUTE_CONTRACT) {
          const content = message.content as MsgExecuteContract;
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const action = Object.keys(JSON.parse(content.msg))[0];
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const jsonMsg = JSON.parse(content.msg);
          const tokenid = jsonMsg[action].token_id;
          const { sender } = content;
          // not cover submessage
          listContractMsgInfo.push({
            contractAddress: content.contract,
            sender,
            action,
            txhash: tx.hash,
            tokenid,
          });
        } else if (message.type === MSG_TYPE.MSG_INSTANTIATE_CONTRACT) {
          const content = message.content as MsgInstantiateContract;
          const action = EVENT_TYPE.INSTANTIATE;
          const { sender } = content;
          const wasmEvent = tx.data.tx_response.logs[index].events.find(
            (event: any) => event.type === EVENT_TYPE.INSTANTIATE
          );
          if (wasmEvent) {
            // not cover submessage
            listContractMsgInfo.push({
              contractAddress: wasmEvent.attributes[0].value,
              sender,
              action,
              txhash: tx.hash,
            });
          }
        }
      });
    }
    return listContractMsgInfo;
  }
}

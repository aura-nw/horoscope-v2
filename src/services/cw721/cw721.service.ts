/* eslint-disable no-await-in-loop */
import { cosmwasm } from '@aura-nw/aurajs';
import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/tx';
import { fromBase64, toBase64, toHex, toUtf8 } from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import CW721Contract from 'src/models/cw721_contract';
import CW721Tx from 'src/models/cw721_tx';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config, getHttpBatchClient } from '../../common';
import {
  BLOCK_CHECKPOINT_JOB_NAME,
  BULL_JOB_NAME,
  CW721_ACTION,
  EVENT_TYPE,
  MSG_TYPE,
  SERVICE,
  SERVICE_NAME,
} from '../../common/constant';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { BlockCheckpoint, Transaction, TransactionMessage } from '../../models';
import Codeid from '../../models/codeid';
import CW721Token from '../../models/cw721_token';

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

@Service({
  name: SERVICE_NAME.ASSET_INDEXER,
  version: 1,
})
export default class AssetTxHandlerService extends BullableService {
  _httpBatchClient: HttpBatchClient;

  _currentAssetHandlerTx = 1;

  _lcdClient: any;

  _assetTxBatch: number = Config.ASSET_TX_BATCH
    ? parseInt(Config.ASSET_TX_BATCH, 10)
    : 100;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
    jobType: BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
  })
  async jobHandlerCw721Transfer(_payload: IContractMsgInfo[]): Promise<void> {
    const batchUpdateTransfer: any[] = [];
    const listTransfer = _payload.filter(
      (item) => item.action === CW721_ACTION.TRANSFER
    );
    const resultListPromise: JsonRpcSuccessResponse[] =
      await this.getTokenInfoForListMsg(listTransfer);
    listTransfer.forEach((item, index) => {
      if (item.tokenid && resultListPromise[index].result.owner) {
        batchUpdateTransfer.push(
          CW721Token.query()
            .where('contract_address', item.contractAddress)
            .andWhere('token_id', item.tokenid)
            .patch({
              owner: resultListPromise[index].result.owner,
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_MINT,
    jobType: BULL_JOB_NAME.HANDLE_CW721_MINT,
  })
  async jobHandlerCw721Mint(_payload: IContractMsgInfo[]): Promise<void> {
    const listMint = _payload.filter(
      (item) => item.action === CW721_ACTION.MINT
    );
    const resultListPromise: JsonRpcSuccessResponse[] =
      await this.getTokenInfoForListMsg(listMint);
    CW721Token.query().insert(
      listMint.map((mintMsg, index) =>
        CW721Token.fromJson({
          token_id: mintMsg.tokenid,
          token_uri: resultListPromise[index].result.info.token_uri,
          extension: resultListPromise[index].result.info.extension,
          owner: resultListPromise[index].result.access.owner,
          contract_address: mintMsg.contractAddress,
        })
      )
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_BURN,
    jobType: BULL_JOB_NAME.HANDLE_CW721_BURN,
  })
  async jobHandlerCw721Burn(_payload: IContractMsgInfo[]): Promise<void> {
    const batchUpdateBurn: any[] = [];
    _payload
      .filter((item) => item.action === CW721_ACTION.BURN)
      .forEach((item) => {
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ASSET_TRANSACTION,
    jobType: BULL_JOB_NAME.HANDLE_ASSET_TRANSACTION,
  })
  async jobHandler(): Promise<void> {
    await this.handleJob();
  }

  async _start(): Promise<void> {
    await this.waitForServices(SERVICE.V1.Cw721.name);
    this._lcdClient = await getLcdClient();
    if (NODE_ENV !== 'test') {
      await this.initEnv();
      this.createJob(
        BULL_JOB_NAME.HANDLE_ASSET_TRANSACTION,
        BULL_JOB_NAME.HANDLE_ASSET_TRANSACTION,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: parseInt(Config.ASSET_MILISECOND_REPEAT_JOB, 10),
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
        const listContractMsg = await this.getContractMsgs(1094, 1104);
        if (listContractMsg.length > 0) {
          await this.setCodeIdForEachContractInList(listContractMsg);
          await this.setTypeForEachContractInList(listContractMsg);
          // insert new cw721 txs
          const cw721Msgs = listContractMsg.filter(
            (msg) => msg.contractType === 'CW721'
          );
          await CW721Tx.query().insert(
            cw721Msgs.map((cw721Msg) =>
              CW721Tx.fromJson({
                action: cw721Msg.action,
                sender: cw721Msg.sender,
                txhash: cw721Msg.txhash,
                contract_address: cw721Msg.contractAddress,
              })
            )
          );
          // insert new cw721 contracts
          await this.handleCw721Msgs(listContractMsg);
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
          .where('job_name', BLOCK_CHECKPOINT_JOB_NAME.TX_ASSET_HANDLER);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  async handleInstanstiateMsgs(batchContract: IContractMsgInfo[]) {
    const cw721MsgsInstantiate = batchContract.filter(
      (msg) =>
        msg.contractType === 'CW721' && msg.action === CW721_ACTION.INSTANTIATE
    );
    const batchContractInfoAndMinter =
      this.getContractInfoAndMinterForBatchContract(
        cw721MsgsInstantiate.map((contract) => contract.contractAddress)
      );

    await CW721Contract.query().insert(
      cw721MsgsInstantiate.map((contract, index) =>
        CW721Contract.fromJson({
          code_id: contract.codeid,
          address: contract.contractAddress,
          name: batchContractInfoAndMinter[index].name,
          symbol: batchContractInfoAndMinter[index].symbol,
          minter: batchContractInfoAndMinter[index].minter,
        })
      )
    );
  }

  handleCw721MsgExec(cw721MsgsExec: IContractMsgInfo[]) {
    this.createJob(
      BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
      BULL_JOB_NAME.HANDLE_CW721_TRANSFER,
      cw721MsgsExec.filter((item) => item.action === CW721_ACTION.TRANSFER),
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.HANDLE_CW721_BURN,
      BULL_JOB_NAME.HANDLE_CW721_BURN,
      cw721MsgsExec.filter((item) => item.action === CW721_ACTION.BURN),
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.HANDLE_CW721_MINT,
      BULL_JOB_NAME.HANDLE_CW721_MINT,
      cw721MsgsExec.filter((item) => item.action === CW721_ACTION.MINT),
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

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
  }

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
      listPromiseContractInfo
    );
    for (
      let index = 0;
      index < resultListPromiseContractInfo.length;
      index += 1
    ) {
      batchContractInfoAndMinter.push({
        name: resultListPromiseContractInfo[index].result.data.name as string,
        symbol: resultListPromiseContractInfo[index].result.data
          .symbol as string,
        minter: resultListPromiseMinter[index].result.data.minter as string,
      });
    }
    return batchContractInfoAndMinter;
  }

  async getTokenInfoForListMsg(listToken: IContractMsgInfo[]): Promise<any[]> {
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
    return Promise.all(listPromise);
  }

  async initEnv() {
    // DB -> Config -> MinDB
    // Get handled txs from db
    let TxIdAssetHandler = await BlockCheckpoint.query().findOne({
      job_name: BLOCK_CHECKPOINT_JOB_NAME.TX_ASSET_HANDLER,
    });
    if (!TxIdAssetHandler) {
      // min Tx from DB
      const minTxId = await Transaction.query().orderBy('id', 'ASC').first();
      if (!minTxId) {
        throw Error('Transaction table empty');
      }
      TxIdAssetHandler = await BlockCheckpoint.query().insert({
        job_name: BLOCK_CHECKPOINT_JOB_NAME.TX_ASSET_HANDLER,
        height: Config.ASSET_START_TX_ID
          ? parseInt(Config.ASSET_START_TX_ID, 10)
          : minTxId.id,
      });
    }
    this._currentAssetHandlerTx = TxIdAssetHandler.height;
    this.logger.info(`_currentAssetHandlerTx: ${this._currentAssetHandlerTx}`);
  }

  async getContractMsgs(from: number, to: number) {
    const listContractInputsAndOutputs: IContractMsgInfo[] = [];
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
          const wasmEvent = tx.data.tx_response.logs[index].events.find(
            (event: any) => event.type === EVENT_TYPE.EXECUTE
          );
          // not cover submessage
          listContractInputsAndOutputs.push({
            contractAddress: wasmEvent.attributes[0].value,
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
          // not cover submessage
          listContractInputsAndOutputs.push({
            contractAddress: wasmEvent.attributes[0].value,
            sender,
            action,
            txhash: tx.hash,
          });
        }
      });
    }
    return listContractInputsAndOutputs;
  }
}

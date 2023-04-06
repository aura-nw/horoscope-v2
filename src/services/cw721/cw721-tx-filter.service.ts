import { cosmwasm } from '@aura-nw/aurajs';
import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/tx';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config, getHttpBatchClient } from '../../common';
import {
  BLOCK_CHECKPOINT_JOB_NAME,
  BULL_JOB_NAME,
  EVENT_TYPE,
  MSG_TYPE,
  SERVICE,
  SERVICE_NAME,
} from '../../common/constant';
import { IContractAndInfo } from '../../common/types/interfaces';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { BlockCheckpoint, Transaction, TransactionMessage } from '../../models';
import Codeid from '../../models/codeid';

const { NODE_ENV } = Config;

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
        const listContractsAndInfo = await this.listContractsAndInfo(
          1094,
          1104
        );
        if (listContractsAndInfo.length > 0) {
          await this.fillContractInfoForList(listContractsAndInfo);
          for (let index = 0; index < listContractsAndInfo.length; index += 1) {
            // eslint-disable-next-line no-await-in-loop
            await this.forwardCw721(listContractsAndInfo[index]);
          }
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

  // checked
  async forwardCw721(item: IContractAndInfo) {
    const { contractInfo } = item;
    if (contractInfo) {
      const type = (
        await Codeid.query()
          .where('codeid', contractInfo.codeId.toString())
          .first()
      )?.type;
      if (type === 'CW721') {
        const payload = {
          address: item.contractAddress,
          codeId: contractInfo.codeId.toString(),
          tokenId: item.tokenid,
          txData: {
            txhash: item.txhash,
            sender: item.sender,
            action: item.action,
          },
        };
        this.broker.call(SERVICE.V1.Cw721.HandleCw721.path, payload);
        this.logger.debug(`Handle CW721:\n${JSON.stringify(payload)}`);
      } else {
        this.logger.warn(
          `Contract address haven't register its type: ${contractInfo.codeId.toString()}`
        );
      }
    }
  }

  // checked
  async fillContractInfoForList(listContractsAndInfo: IContractAndInfo[]) {
    const listPromise: any[] = [];
    listContractsAndInfo.forEach((e: IContractAndInfo) => {
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
    listContractsAndInfo.forEach((item, index) => {
      Object.assign(item, {
        contractInfo: cosmwasm.wasm.v1.QueryContractInfoResponse.decode(
          fromBase64(resultListPromise[index].result.response.value)
        ).contractInfo,
      });
    });
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

  async listContractsAndInfo(from: number, to: number) {
    const listContractInputsAndOutputs: IContractAndInfo[] = [];
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

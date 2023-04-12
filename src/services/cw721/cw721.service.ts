import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/tx';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config, getHttpBatchClient } from '../../common';
import {
  BLOCK_CHECKPOINT_JOB_NAME,
  BULL_JOB_NAME,
  MSG_TYPE,
  SERVICE_NAME,
} from '../../common/constant';
import { getLcdClient } from '../../common/utils/aurajs_client';
import {
  BlockCheckpoint,
  Transaction,
  TransactionEvent,
  TransactionEventAttribute,
  TransactionMessage,
} from '../../models';
import Codeid from '../../models/code_id';
import CW721Contract from '../../models/cw721_contract';
import CW721Token from '../../models/cw721_token';
import CW721Tx from '../../models/cw721_tx';

const { NODE_ENV } = Config;

interface IContractMsgInfo {
  sender: string;
  contractAddress: string;
  action: string;
  txhash: string;
  token_id?: string;
  code_id?: string;
  contractType?: string;
  content: string;
}

const CW721_ACTION = {
  MINT: 'mint',
  BURN: 'burn',
  TRANSFER: 'transfer_nft',
  INSTANTIATE: 'instantiate',
};

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

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_EXECUTE,
    jobType: BULL_JOB_NAME.HANDLE_CW721_EXECUTE,
  })
  async jobHandlerCw721(listMsgsExecute: IContractMsgInfo[]) {
    // handle mint
    await this.handlerCw721Mint(
      listMsgsExecute.filter((msg) => msg.action === CW721_ACTION.MINT)
    );
    // handle transfer
    await this.handlerCw721Transfer(
      listMsgsExecute.filter((msg) => msg.action === CW721_ACTION.TRANSFER)
    );
    // handle burn
    await this.handlerCw721Burn(
      listMsgsExecute.filter((msg) => msg.action === CW721_ACTION.BURN)
    );
  }

  // checked
  async handlerCw721Transfer(listTransfer: IContractMsgInfo[]): Promise<void> {
    const batchUpdateTransfer: any[] = [];
    listTransfer.forEach((item) => {
      const newOwner = JSON.parse(item.content)[item.action]?.recipient;
      if (item.token_id && newOwner) {
        batchUpdateTransfer.push(
          CW721Token.query()
            .where('contract_address', item.contractAddress)
            .andWhere('token_id', item.token_id)
            .patch({
              owner: newOwner,
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

  // checked
  async handlerCw721Mint(listMint: IContractMsgInfo[]): Promise<void> {
    await CW721Token.query().insert(
      listMint.map((mintMsg) =>
        CW721Token.fromJson({
          token_id: mintMsg.token_id,
          token_uri: JSON.parse(mintMsg.content)[mintMsg.action]?.token_uri,
          extension: JSON.parse(mintMsg.content)[mintMsg.action]?.extension,
          owner: JSON.parse(mintMsg.content)[mintMsg.action]?.owner,
          contract_address: mintMsg.contractAddress,
        })
      )
    );
  }

  // checked
  async handlerCw721Burn(listBurn: IContractMsgInfo[]): Promise<void> {
    const batchUpdateBurn: any[] = [];
    listBurn.forEach((item) => {
      if (item.token_id) {
        batchUpdateBurn.push(
          CW721Token.query()
            .where('contract_address', item.contractAddress)
            .andWhere('token_id', item.token_id)
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
          // handle instantiate cw721 contracts
          await this.handleInstantiateMsgs(listContractMsg);
          // filter Cw721 Msgs
          const cw721ListAddr = (
            await CW721Contract.query().whereIn(
              'address',
              listContractMsg.map((msg) => msg.contractAddress)
            )
          ).map((record) => record.address);
          const cw721Msgs = listContractMsg.filter((msg) =>
            cw721ListAddr.includes(msg.contractAddress)
          );
          // handle Cw721 Tx
          await this.handleCw721Tx(cw721Msgs);
          // handle all cw721 execute messages
          this.handleCw721MsgExec(cw721Msgs);
        }
        await BlockCheckpoint.query()
          .patch({
            height: listTx[listTx.length - 1].id + 1,
          })
          .where('job_name', BLOCK_CHECKPOINT_JOB_NAME.CW721_HANDLER);
        this._currentAssetHandlerTx = listTx[listTx.length - 1].id + 1;
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  // checked
  async handleCw721Tx(listCw721Msgs: IContractMsgInfo[]) {
    // insert new cw721 txs
    const cw721Txs = listCw721Msgs.map((cw721Msg) =>
      CW721Tx.fromJson({
        action: cw721Msg.action,
        sender: cw721Msg.sender,
        txhash: cw721Msg.txhash,
        contract_address: cw721Msg.contractAddress,
        token_id: cw721Msg.token_id,
      })
    );
    if (cw721Txs.length > 0) {
      await CW721Tx.query().insert(cw721Txs);
    }
  }

  // checked
  async handleInstantiateMsgs(batchContract: IContractMsgInfo[]) {
    // filter all msg instantiate
    const msgsInstantiate = batchContract.filter(
      (msg) => msg.action === CW721_ACTION.INSTANTIATE
    );
    await Promise.all(
      msgsInstantiate.map(async (msg) => {
        const type = (
          await Codeid.query()
            .where('code_id', msg.code_id ? msg.code_id : 'unknown')
            .first()
        )?.type;
        return Object.assign(msg, { contractType: type });
      })
    );
    // filter cw721 msg instantiate
    const cw721MsgsInstantiate = msgsInstantiate.filter(
      (msg) => msg.contractType === 'CW721'
    );
    if (cw721MsgsInstantiate.length > 0) {
      const instantiateContracts = cw721MsgsInstantiate.map((msg) =>
        CW721Contract.fromJson({
          code_id: msg.code_id,
          address: msg.contractAddress,
          name: JSON.parse(msg.content).name,
          symbol: JSON.parse(msg.content).symbol,
          minter: JSON.parse(msg.content).minter,
        })
      );
      await CW721Contract.query().insert(instantiateContracts);
    }
  }

  // checked
  handleCw721MsgExec(cw721Msgs: IContractMsgInfo[]) {
    // filter all msg execute
    const cw721MsgsExecute = cw721Msgs.filter(
      (msg) => msg.action !== CW721_ACTION.INSTANTIATE
    );
    // create execute msg job
    if (cw721MsgsExecute.length > 0) {
      this.createJob(
        BULL_JOB_NAME.HANDLE_CW721_EXECUTE,
        BULL_JOB_NAME.HANDLE_CW721_EXECUTE,
        cw721MsgsExecute,
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    }
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
      if (tx.code === 0) {
        tx.messages.forEach((message: TransactionMessage, index: number) => {
          if (message.type === MSG_TYPE.MSG_EXECUTE_CONTRACT) {
            const content = message.content as MsgExecuteContract;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const action = Object.keys(JSON.parse(content.msg))[0];
            const wasmEvents = tx.data.tx_response.logs[index].events.filter(
              (event: any) => event.type === TransactionEvent.EVENT_TYPE.WASM
            );
            const { sender } = content;
            // not cover submessage
            wasmEvents.forEach((event: any) => {
              const tokenidAttribute = event.attributes.find(
                (attr: any) =>
                  attr.key === TransactionEventAttribute.EVENT_KEY.TOKEN_ID
              );
              if (tokenidAttribute) {
                listContractMsgInfo.push({
                  contractAddress: content.contract,
                  sender,
                  action,
                  txhash: tx.hash,
                  token_id: tokenidAttribute.value,
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  content: content.msg,
                });
              }
            });
          } else if (message.type === MSG_TYPE.MSG_INSTANTIATE_CONTRACT) {
            const content = message.content as MsgInstantiateContract;
            const action = TransactionEvent.EVENT_TYPE.INSTANTIATE;
            const { sender } = content;
            const instantiateEvent = tx.data.tx_response.logs[
              index
            ].events.find(
              (event: any) =>
                event.type === TransactionEvent.EVENT_TYPE.INSTANTIATE
            );
            if (instantiateEvent) {
              const { low, high }: { low: number; high: number } =
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                content.code_id;
              let codeId = low.toString();
              if (high) {
                codeId = high.toString() + codeId;
              }
              // not cover submessage
              listContractMsgInfo.push({
                contractAddress: instantiateEvent.attributes.find(
                  (attr: any) =>
                    attr.key ===
                    TransactionEventAttribute.EVENT_KEY._CONTRACT_ADDRESS
                ).value,
                sender,
                action,
                txhash: tx.hash,
                code_id: codeId,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                content: content.msg,
              });
            }
          }
        });
      }
    }
    return listContractMsgInfo;
  }
}

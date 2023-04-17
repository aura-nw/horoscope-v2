import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/tx';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import {
  BLOCK_CHECKPOINT_JOB_NAME,
  BULL_JOB_NAME,
  MSG_TYPE,
  SERVICE_NAME,
} from '../../common/constant';
import {
  Block,
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
  action?: string;
  contractType?: string;
  content: string;
  wasm_attributes?: {
    key: string;
    value: string;
  }[];
  tx: Transaction;
}

interface IInstantiateMsgInfo extends IContractMsgInfo {
  code_id: string;
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
  _blocksPerBatch!: number;

  _currentAssetHandlerBlock!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  // checked
  async handlerCw721Transfer(transferMsgs: IContractMsgInfo[]): Promise<void> {
    // eslint-disable-next-line no-restricted-syntax
    for (const transferMsg of transferMsgs) {
      const newOwner = this.getAttributeFrom(
        transferMsg.wasm_attributes,
        TransactionEventAttribute.EVENT_KEY.RECIPIENT
      );
      const tokenId = this.getAttributeFrom(
        transferMsg.wasm_attributes,
        TransactionEventAttribute.EVENT_KEY.TOKEN_ID
      );
      if (tokenId && newOwner) {
        // eslint-disable-next-line no-await-in-loop
        await CW721Token.query()
          .where('contract_address', transferMsg.contractAddress)
          .andWhere('token_id', tokenId)
          .patch({
            owner: newOwner,
            last_updated_height: transferMsg.tx.height,
          });
      } else {
        throw new Error(
          `Msg transfer in tx ${transferMsg.tx.hash} not found token id transfered or not found new owner`
        );
      }
    }
  }

  // checked
  async handlerCw721Mint(mintMsgs: IContractMsgInfo[]): Promise<void> {
    if (mintMsgs.length > 0) {
      await CW721Token.query()
        .insert(
          mintMsgs.map((mintMsg) => {
            const tokenId = this.getAttributeFrom(
              mintMsg.wasm_attributes,
              TransactionEventAttribute.EVENT_KEY.TOKEN_ID
            );
            const tokenUri = JSON.parse(mintMsg.content)[CW721_ACTION.MINT]
              ?.token_uri;
            const extension = JSON.parse(mintMsg.content)[CW721_ACTION.MINT]
              ?.extension;
            return CW721Token.fromJson({
              token_id: tokenId,
              token_uri: tokenUri,
              extension,
              owner: this.getAttributeFrom(
                mintMsg.wasm_attributes,
                TransactionEventAttribute.EVENT_KEY.OWNER
              ),
              contract_address: mintMsg.contractAddress,
              last_updated_height: mintMsg.tx.height,
            });
          })
        )
        .onConflict(['token_id', 'contract_address', 'last_updated_height'])
        .merge();
    }
  }

  // checked
  async handlerCw721Burn(burnMsgs: IContractMsgInfo[]): Promise<void> {
    try {
      await knex.transaction(async (trx) => {
        const queries: any[] = [];
        burnMsgs.forEach((burnMsg) => {
          const tokenId = this.getAttributeFrom(
            burnMsg.wasm_attributes,
            TransactionEventAttribute.EVENT_KEY.TOKEN_ID
          );
          if (tokenId) {
            const query = CW721Token.query()
              .where('contract_address', burnMsg.contractAddress)
              .andWhere('token_id', tokenId)
              .patch({
                last_updated_height: burnMsg.tx.height,
                burned: true,
              })
              .transacting(trx);
            queries.push(query);
          }
        });
        await Promise.all(queries) // Once every query is written
          .then(trx.commit) // We try to execute all of them
          .catch(trx.rollback); // And rollback in case any of them goes wrong
      });
    } catch (err) {
      this.logger.error(err);
    }
  }

  // checked
  @QueueHandler({
    queueName: BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
    jobType: BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
  })
  async jobHandler(): Promise<void> {
    if (this._currentAssetHandlerBlock) {
      await this.handleJob();
    }
  }

  // checked
  async _start(): Promise<void> {
    this._blocksPerBatch = config.cw721.blocksPerBatch
      ? config.cw721.blocksPerBatch
      : 100;
    if (NODE_ENV !== 'test') {
      await this.initEnv();
      await this.createJob(
        BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
        BULL_JOB_NAME.FILTER_CW721_TRANSACTION,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.cw721.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }

  async handleJob() {
    // get range txs for proccessing
    const startBlock: number = this._currentAssetHandlerBlock;
    const latestBlock = await Block.query()
      .orderBy('height', 'DESC')
      .first()
      .throwIfNotFound();
    const endBlock: number = Math.min(
      startBlock + this._blocksPerBatch,
      latestBlock.height
    );
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    if (endBlock >= startBlock) {
      try {
        // get all contract Msg in above range blocks
        const listContractMsg = await this.getContractMsgs(
          startBlock,
          endBlock
        );
        if (listContractMsg.length > 0) {
          // handle instantiate cw721 contracts
          await this.handleInstantiateMsgs(
            listContractMsg.filter(
              (msg) => msg.action === CW721_ACTION.INSTANTIATE
            ) as IInstantiateMsgInfo[]
          );
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
          await this.handleCw721MsgExec(
            cw721Msgs.filter((msg) => msg.action !== CW721_ACTION.INSTANTIATE)
          );
        }
      } catch (error) {
        this.logger.error(error);
      }
    }
    await BlockCheckpoint.query()
      .patch({
        height: endBlock + 1,
      })
      .where('job_name', BLOCK_CHECKPOINT_JOB_NAME.CW721_HANDLER);
    this._currentAssetHandlerBlock = endBlock + 1;
  }

  // checked
  async handleCw721Tx(listCw721Msgs: IContractMsgInfo[]) {
    // insert new cw721 txs
    const cw721Txs = listCw721Msgs.map((cw721Msg) => {
      const tokenId = this.getAttributeFrom(
        cw721Msg.wasm_attributes,
        TransactionEventAttribute.EVENT_KEY.TOKEN_ID
      );
      return CW721Tx.fromJson({
        action: cw721Msg.action,
        sender: cw721Msg.sender,
        tx_hash: cw721Msg.tx.hash,
        contract_address: cw721Msg.contractAddress,
        token_id: tokenId,
      });
    });
    if (cw721Txs.length > 0) {
      await CW721Tx.query()
        .insert(cw721Txs)
        .onConflict(['tx_hash', 'contract_address', 'action', 'token_id'])
        .merge();
    }
  }

  // checked
  async handleInstantiateMsgs(msgsInstantiate: IInstantiateMsgInfo[]) {
    // get all code_id which is cw721 and in above list msgs
    const cw721CodeIds = (
      await Codeid.query()
        .whereIn(
          'code_id',
          msgsInstantiate.map((msg) => msg.code_id)
        )
        .andWhere('type', 'CW721')
    ).map((record) => record.code_id);
    // filter cw721 msg instantiate
    const cw721MsgsInstantiate = msgsInstantiate.filter((msg) =>
      cw721CodeIds.includes(msg.code_id)
    );
    if (cw721MsgsInstantiate.length > 0) {
      const instantiateContracts = cw721MsgsInstantiate.map((msg) => {
        const content = JSON.parse(msg.content);
        return CW721Contract.fromJson({
          code_id: msg.code_id,
          address: msg.contractAddress,
          name: content.name,
          symbol: content.symbol,
          minter: content.minter,
        });
      });
      await CW721Contract.query()
        .insert(instantiateContracts)
        .onConflict('address')
        .merge();
    }
  }

  // checked
  async handleCw721MsgExec(cw721MsgsExecute: IContractMsgInfo[]) {
    // handle mint
    await this.handlerCw721Mint(
      cw721MsgsExecute.filter((msg) => msg.action === CW721_ACTION.MINT)
    );
    // handle transfer
    await this.handlerCw721Transfer(
      cw721MsgsExecute.filter((msg) => msg.action === CW721_ACTION.TRANSFER)
    );
    // handle burn
    await this.handlerCw721Burn(
      cw721MsgsExecute.filter((msg) => msg.action === CW721_ACTION.BURN)
    );
  }

  // checked
  async initEnv() {
    // DB -> Config -> MinDB
    // Get handled blocks from db
    let blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BLOCK_CHECKPOINT_JOB_NAME.CW721_HANDLER,
    });
    if (!blockCheckpoint) {
      // min Tx from DB
      const minBlock = await Block.query()
        .orderBy('height', 'ASC')
        .first()
        .throwIfNotFound();
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BLOCK_CHECKPOINT_JOB_NAME.CW721_HANDLER,
        height: config.cw721.startBlock
          ? config.cw721.startBlock
          : minBlock.height,
      });
    }
    this._currentAssetHandlerBlock = blockCheckpoint.height;
    this.logger.info(
      `_currentAssetHandlerBlock: ${this._currentAssetHandlerBlock}`
    );
  }

  // checked
  async getContractMsgs(startBlock: number, endBlock: number) {
    const listContractMsgInfo: (IContractMsgInfo | IInstantiateMsgInfo)[] = [];
    // from, from+1, ... to
    const txs = await Transaction.query()
      .alias('tx')
      .whereBetween('tx.height', [startBlock, endBlock])
      .andWhere('tx.code', 0)
      .withGraphJoined('messages')
      .whereIn('messages.type', [
        MSG_TYPE.MSG_EXECUTE_CONTRACT,
        MSG_TYPE.MSG_INSTANTIATE_CONTRACT,
      ])
      .orderBy('id', 'ASC');

    // eslint-disable-next-line no-restricted-syntax
    for (const tx of txs) {
      tx.messages.forEach((message: TransactionMessage, index: number) => {
        if (message.type === MSG_TYPE.MSG_EXECUTE_CONTRACT) {
          const content = message.content as MsgExecuteContract;
          const wasmEvent = tx.data.tx_response.logs[index].events.find(
            (event: any) => event.type === TransactionEvent.EVENT_TYPE.WASM
          );
          if (wasmEvent) {
            // split into wasm sub-events
            const listWasmSubEventAttrs = wasmEvent.attributes.reduce(
              (acc: any, curr: any) => {
                if (
                  curr.key ===
                  TransactionEventAttribute.EVENT_KEY._CONTRACT_ADDRESS
                ) {
                  acc.push([curr]); // start a new sub-array with the current element
                } else if (acc.length > 0) {
                  acc[acc.length - 1].push(curr); // add the current element to the last sub-array
                }
                return acc;
              },
              []
            );
            const { sender } = content;
            listWasmSubEventAttrs.forEach((wasmSubEventAttrs: any) => {
              const action = this.getAttributeFrom(
                wasmSubEventAttrs,
                TransactionEventAttribute.EVENT_KEY.ACTION
              );
              listContractMsgInfo.push({
                contractAddress: this.getAttributeFrom(
                  wasmSubEventAttrs,
                  TransactionEventAttribute.EVENT_KEY._CONTRACT_ADDRESS
                ),
                sender,
                action,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                content: content.msg,
                wasm_attributes: wasmSubEventAttrs,
                tx,
              });
            });
          }
        } else if (message.type === MSG_TYPE.MSG_INSTANTIATE_CONTRACT) {
          const content = message.content as MsgInstantiateContract;
          const action = TransactionEvent.EVENT_TYPE.INSTANTIATE;
          const { sender } = content;
          const instantiateEvent = tx.data.tx_response.logs[index].events.find(
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
              contractAddress: this.getAttributeFrom(
                instantiateEvent.attributes,
                TransactionEventAttribute.EVENT_KEY._CONTRACT_ADDRESS
              ),
              sender,
              action,
              code_id: codeId,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              content: content.msg,
              tx,
            });
          }
        }
      });
    }
    return listContractMsgInfo;
  }

  // checked
  getAttributeFrom(listAttributes: any, attributeType: string) {
    return listAttributes?.find((attr: any) => attr.key === attributeType)
      ?.value;
  }
}

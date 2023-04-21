import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/tx';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { CodeId } from '../../models/code_id';
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
  Event,
  EventAttribute,
  TransactionMessage,
} from '../../models';
import CW721Contract from '../../models/cw721_contract';
import CW721Token from '../../models/cw721_token';
import CW721Activity from '../../models/cw721_tx';

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
  code_id: number;
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

  // checked + tested
  async handlerCw721Transfer(transferMsgs: IContractMsgInfo[]): Promise<void> {
    // get Ids for contracts
    const cw721ContractDbRecords = await CW721Contract.query()
      .whereIn(
        'address',
        transferMsgs.map((cw721Msg) => cw721Msg.contractAddress)
      )
      .select('address', 'id');
    // eslint-disable-next-line no-restricted-syntax
    for (const transferMsg of transferMsgs) {
      const recipient = this.getAttributeFrom(
        transferMsg.wasm_attributes,
        EventAttribute.EVENT_KEY.RECIPIENT
      );
      const tokenId = this.getAttributeFrom(
        transferMsg.wasm_attributes,
        EventAttribute.EVENT_KEY.TOKEN_ID
      );
      // find the id for correspond smart contract
      const cw721ContractId = cw721ContractDbRecords.find(
        (item) => item.address === transferMsg.contractAddress
      )?.id;
      if (cw721ContractId) {
        if (tokenId && recipient) {
          // eslint-disable-next-line no-await-in-loop
          await CW721Token.query()
            .where('cw721_contract_id', cw721ContractId)
            .andWhere('onchain_token_id', tokenId)
            .patch({
              owner: recipient,
              last_updated_height: transferMsg.tx.height,
            });
        } else {
          throw new Error(
            `Msg transfer in tx ${transferMsg.tx.hash} not found token id transfered or not found new owner`
          );
        }
      } else {
        throw new Error(
          `Msg transfer in tx ${transferMsg.tx.hash} not found contract address in cw721 contract DB`
        );
      }
    }
  }

  // checked + tested
  async handlerCw721Mint(mintMsgs: IContractMsgInfo[]): Promise<void> {
    if (mintMsgs.length > 0) {
      // from list contract address, get those ids
      const cw721ContractDbRecords = await CW721Contract.query()
        .whereIn(
          'address',
          mintMsgs.map((cw721Msg) => cw721Msg.contractAddress)
        )
        .select('address', 'id');

      const newTokens = mintMsgs.map((mintMsg) => {
        const tokenId = this.getAttributeFrom(
          mintMsg.wasm_attributes,
          EventAttribute.EVENT_KEY.TOKEN_ID
        );
        const tokenUri = JSON.parse(mintMsg.content)[CW721_ACTION.MINT]
          ?.token_uri;
        const extension = JSON.parse(mintMsg.content)[CW721_ACTION.MINT]
          ?.extension;
        const cw721ContractId = cw721ContractDbRecords.find(
          (item) => item.address === mintMsg.contractAddress
        )?.id;
        if (!cw721ContractId) {
          throw new Error(
            `Msg transfer in tx ${mintMsg.tx.hash} not found contract address in cw721 contract DB`
          );
        }
        return CW721Token.fromJson({
          onchain_token_id: tokenId,
          token_uri: tokenUri,
          extension,
          owner: this.getAttributeFrom(
            mintMsg.wasm_attributes,
            EventAttribute.EVENT_KEY.OWNER
          ),
          cw721_contract_id: cw721ContractId,
          last_updated_height: mintMsg.tx.height,
          burned: false,
        });
      });
      await CW721Token.query()
        .insert(newTokens)
        .onConflict(['onchain_token_id', 'cw721_contract_id'])
        .merge();
    }
  }

  // checked
  async handlerCw721Burn(burnMsgs: IContractMsgInfo[]): Promise<void> {
    try {
      // get Ids for contracts
      const cw721ContractDbRecords = await CW721Contract.query()
        .whereIn(
          'address',
          burnMsgs.map((cw721Msg) => cw721Msg.contractAddress)
        )
        .select('address', 'id');
      await knex.transaction(async (trx) => {
        const queries: any[] = [];
        burnMsgs.forEach((burnMsg) => {
          // find the burnMsg's smart contract id
          const cw721ContractId = cw721ContractDbRecords.find(
            (item) => item.address === burnMsg.contractAddress
          )?.id;
          if (!cw721ContractId) {
            // burn cw721 token but its contract haven't been in DB
            // this case happened when
            throw new Error(
              `Msg transfer in tx ${burnMsg.tx.hash} not found contract address in cw721 contract DB`
            );
          }
          const tokenId = this.getAttributeFrom(
            burnMsg.wasm_attributes,
            EventAttribute.EVENT_KEY.TOKEN_ID
          );
          if (tokenId) {
            const query = CW721Token.query()
              .where('cw721_contract_id', cw721ContractId)
              .andWhere('onchain_token_id', tokenId)
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
      .limit(1)
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
          // handle all cw721 execute messages
          await this.handleCw721MsgExec(
            cw721Msgs.filter((msg) => msg.action !== CW721_ACTION.INSTANTIATE)
          );
          // handle Cw721 Activity
          await this.handleCW721Activity(cw721Msgs);
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

  // checked + tested
  async handleCW721Activity(listCw721Msgs: IContractMsgInfo[]) {
    // from list onchain token-ids, get cw721-token-id
    const cw721TokenIds = await this.getIdsForTokens(
      listCw721Msgs.map((cw721Msg) => ({
        contractAddress: cw721Msg.contractAddress,
        onchainTokenId: this.getAttributeFrom(
          cw721Msg.wasm_attributes,
          EventAttribute.EVENT_KEY.TOKEN_ID
        ),
      }))
    );
    // from list contract address, get cw721-contract-id
    const Cw721ContractDbRecords = await CW721Contract.query()
      .whereIn(
        'address',
        listCw721Msgs.map((cw721Msg) => cw721Msg.contractAddress)
      )
      .select('address', 'id');
    // insert new cw721 activity
    const CW721Activities = listCw721Msgs.map((cw721Msg) => {
      const cw721ContractId = Cw721ContractDbRecords.find(
        (item) => item.address === cw721Msg.contractAddress
      )?.id;
      const onchainTokenId = this.getAttributeFrom(
        cw721Msg.wasm_attributes,
        EventAttribute.EVENT_KEY.TOKEN_ID
      );
      let cw721TokenId = null;
      if (onchainTokenId) {
        const foundRecord = cw721TokenIds.find(
          (item) =>
            item.contract_address === cw721Msg.contractAddress &&
            item.onchain_token_id === onchainTokenId
        );
        if (foundRecord) {
          cw721TokenId = foundRecord.cw721_token_id;
        } else {
          this.logger.error(
            `Token ${onchainTokenId} in smart contract ${cw721Msg.contractAddress} not found in DB`
          );
        }
      }
      return CW721Activity.fromJson({
        action: cw721Msg.action,
        sender: cw721Msg.sender,
        tx_hash: cw721Msg.tx.hash,
        cw721_contract_id: cw721ContractId,
        cw721_token_id: cw721TokenId,
      });
    });
    if (CW721Activities.length > 0) {
      await CW721Activity.query()
        .insert(CW721Activities)
        .onConflict([
          'tx_hash',
          'cw721_contract_id',
          'action',
          'cw721_token_id',
        ])
        .merge();
    }
  }

  // checked
  async handleInstantiateMsgs(msgsInstantiate: IInstantiateMsgInfo[]) {
    // get all code_id which is cw721 and in above list msgs
    const cw721CodeIds = (
      await CodeId.query()
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
        .limit(1)
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
    const contractMsgsInfo: (IContractMsgInfo | IInstantiateMsgInfo)[] = [];
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
            (event: any) => event.type === Event.EVENT_TYPE.WASM
          );
          if (wasmEvent) {
            // split into wasm sub-events
            const wasmEventByContracts = wasmEvent.attributes.reduce(
              (
                acc: { key: string; value: string }[][],
                curr: { key: string; value: string }
              ) => {
                if (curr.key === EventAttribute.EVENT_KEY._CONTRACT_ADDRESS) {
                  acc.push([curr]); // start a new sub-array with the current element
                } else if (acc.length > 0) {
                  acc[acc.length - 1].push(curr); // add the current element to the last sub-array
                }
                return acc;
              },
              []
            );
            const { sender } = content;
            wasmEventByContracts.forEach((wasmSubEventAttrs: any) => {
              const action = this.getAttributeFrom(
                wasmSubEventAttrs,
                EventAttribute.EVENT_KEY.ACTION
              );
              contractMsgsInfo.push({
                contractAddress: this.getAttributeFrom(
                  wasmSubEventAttrs,
                  EventAttribute.EVENT_KEY._CONTRACT_ADDRESS
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
          const action = Event.EVENT_TYPE.INSTANTIATE;
          const { sender } = content;
          const instantiateEvent = tx.data.tx_response.logs[index].events.find(
            (event: any) => event.type === Event.EVENT_TYPE.INSTANTIATE
          );
          if (instantiateEvent) {
            const instantiateEventByContracts =
              instantiateEvent.attributes.reduce(
                (
                  acc: { key: string; value: string }[][],
                  curr: { key: string; value: string }
                ) => {
                  if (curr.key === EventAttribute.EVENT_KEY._CONTRACT_ADDRESS) {
                    acc.push([curr]); // start a new sub-array with the current element
                  } else if (acc.length > 0) {
                    acc[acc.length - 1].push(curr); // add the current element to the last sub-array
                  }
                  return acc;
                },
                []
              );
            instantiateEventByContracts.forEach(
              (instantiateSubEventAttrs: any) => {
                const codeId = parseInt(
                  this.getAttributeFrom(
                    instantiateSubEventAttrs,
                    EventAttribute.EVENT_KEY.CODE_ID
                  ),
                  10
                );
                contractMsgsInfo.push({
                  contractAddress: this.getAttributeFrom(
                    instantiateSubEventAttrs,
                    EventAttribute.EVENT_KEY._CONTRACT_ADDRESS
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
            );
          }
        }
      });
    }
    this.logger.debug(contractMsgsInfo);
    return contractMsgsInfo;
  }

  // checked + tested
  getAttributeFrom(listAttributes: any, attributeType: string) {
    return listAttributes?.find((attr: any) => attr.key === attributeType)
      ?.value;
  }

  // checked + tested
  async getIdsForTokens(
    tokens: { contractAddress: string; onchainTokenId: string }[]
  ) {
    return CW721Token.query()
      .alias('cw721_token')
      .withGraphJoined('contract')
      .whereIn(
        ['contract.address', 'cw721_token.onchain_token_id'],
        tokens
          .map((token) => ({
            contract_address: token.contractAddress,
            token_id: token.onchainTokenId,
          }))
          .filter((token) => token.token_id)
          .map(({ contract_address, token_id }) => [contract_address, token_id])
      )
      .select(
        'contract.address as contract_address',
        'cw721_token.onchain_token_id as onchain_token_id',
        'cw721_token.id as cw721_token_id'
      );
  }
}

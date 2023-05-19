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
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config, getHttpBatchClient } from '../../common';
import { BULL_JOB_NAME, SERVICE } from '../../common/constant';
import knex from '../../common/utils/db_connection';
import { Block, BlockCheckpoint, EventAttribute } from '../../models';
import CW721Contract from '../../models/cw721_contract';
import CW721Token from '../../models/cw721_token';
import CW721Activity from '../../models/cw721_tx';
import { SmartContract } from '../../models/smart_contract';
import {
  IContractMsgInfo,
  getAttributeFrom,
  getContractActivities,
  removeDuplicate,
} from '../../common/utils/smart_contract';

const { NODE_ENV } = Config;

interface IContractInfoAndMinter {
  address: string;
  name: string;
  symbol: string;
  minter: string;
}

const CW721_ACTION = {
  MINT: 'mint',
  BURN: 'burn',
  TRANSFER: 'transfer_nft',
  INSTANTIATE: 'instantiate',
};

@Service({
  name: SERVICE.V1.Cw721.key,
  version: 1,
})
export default class Cw721HandlerService extends BullableService {
  _httpBatchClient!: HttpBatchClient;

  _blocksPerBatch!: number;

  _currentAssetHandlerBlock!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  // update new owner and last_update_height
  async handlerCw721Transfer(transferMsgs: IContractMsgInfo[]): Promise<void> {
    // remove duplicate transfer event for same token
    const distinctTransfers = removeDuplicate(transferMsgs);
    // get Ids for contracts
    const cw721ContractDbRecords = await this.getCw721ContractsRecords(
      distinctTransfers.map((transferMsg) => transferMsg.contractAddress)
    );
    await knex.transaction(async (trx) => {
      const queries: any[] = [];
      distinctTransfers.forEach((transferMsg) => {
        const recipient = getAttributeFrom(
          transferMsg.wasm_attributes,
          EventAttribute.ATTRIBUTE_KEY.RECIPIENT
        );
        const tokenId = getAttributeFrom(
          transferMsg.wasm_attributes,
          EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
        );
        // find the id for correspond smart contract
        const cw721ContractId = cw721ContractDbRecords.find(
          (item) => item.address === transferMsg.contractAddress
        )?.id;
        if (cw721ContractId) {
          if (tokenId && recipient) {
            queries.push(
              CW721Token.query()
                .where('cw721_contract_id', cw721ContractId)
                .andWhere('token_id', tokenId)
                .andWhere('last_updated_height', '<', transferMsg.tx.height)
                .patch({
                  owner: recipient,
                  last_updated_height: transferMsg.tx.height,
                })
            );
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
      });
      await Promise.all(queries) // Once every query is written
        .then(trx.commit) // Try to execute all of them
        .catch(trx.rollback); // And rollback in case any of them goes wrong
    });
  }

  // Insert new token if it haven't been in cw721_token table, or update burned to false if it already have been there
  async handlerCw721Mint(mintMsgs: IContractMsgInfo[]): Promise<void> {
    if (mintMsgs.length > 0) {
      // from list contract address, get those ids
      const cw721ContractDbRecords = await this.getCw721ContractsRecords(
        mintMsgs.map((cw721Msg) => cw721Msg.contractAddress)
      );
      const newTokens = mintMsgs.map((mintMsg) => {
        const tokenId = getAttributeFrom(
          mintMsg.wasm_attributes,
          EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
        );
        const mediaInfo = null;
        const cw721ContractId = cw721ContractDbRecords.find(
          (item) => item.address === mintMsg.contractAddress
        )?.id;
        if (!cw721ContractId) {
          throw new Error(
            `Msg transfer in tx ${mintMsg.tx.hash} not found contract address in cw721 contract DB`
          );
        }
        return CW721Token.fromJson({
          token_id: tokenId,
          media_info: mediaInfo,
          owner: getAttributeFrom(
            mintMsg.wasm_attributes,
            EventAttribute.ATTRIBUTE_KEY.OWNER
          ),
          cw721_contract_id: cw721ContractId,
          last_updated_height: mintMsg.tx.height,
          burned: false,
        });
      });
      await CW721Token.query()
        .insert(newTokens)
        .onConflict(['token_id', 'cw721_contract_id'])
        .merge();
    }
  }

  // update burned field in cw721_token to true, last updated height
  async handlerCw721Burn(burnMsgs: IContractMsgInfo[]): Promise<void> {
    try {
      // get Ids for contracts
      const cw721ContractDbRecords = await this.getCw721ContractsRecords(
        burnMsgs.map((cw721Msg) => cw721Msg.contractAddress)
      );
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
          const tokenId = getAttributeFrom(
            burnMsg.wasm_attributes,
            EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
          );
          if (tokenId) {
            const query = CW721Token.query()
              .where('cw721_contract_id', cw721ContractId)
              .andWhere('token_id', tokenId)
              .andWhere('last_updated_height', '<', burnMsg.tx.height)
              .patch({
                last_updated_height: burnMsg.tx.height,
                burned: true,
              })
              .transacting(trx);
            queries.push(query);
          }
        });
        await Promise.all(queries) // Once every query is written
          .then(trx.commit) // Try to execute all of them
          .catch(trx.rollback); // And rollback in case any of them goes wrong
      });
    } catch (err) {
      this.logger.error(err);
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
    jobName: BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
  })
  async jobHandler(): Promise<void> {
    if (this._currentAssetHandlerBlock) {
      await this.handleJob();
    }
  }

  async _start(): Promise<void> {
    this._httpBatchClient = getHttpBatchClient();
    this._blocksPerBatch = config.cw721.blocksPerBatch
      ? config.cw721.blocksPerBatch
      : 100;
    if (NODE_ENV !== 'test') {
      await this.initEnv();
      await this.createJob(
        BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
        BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
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

  // main function
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
        const listContractMsg = await getContractActivities(
          startBlock,
          endBlock
        );
        if (listContractMsg.length > 0) {
          // handle instantiate cw721 contracts
          await this.handleInstantiateMsgs(
            listContractMsg.filter(
              (msg) => msg.action === CW721_ACTION.INSTANTIATE
            ) as IContractMsgInfo[]
          );
          // filter Cw721 Msgs
          const cw721ListAddr = (
            await this.getCw721ContractsRecords(
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
      .where('job_name', BULL_JOB_NAME.HANDLE_CW721_TRANSACTION);
    this._currentAssetHandlerBlock = endBlock + 1;
  }

  // Insert new activities into cw721_activity table
  async handleCW721Activity(listCw721Msgs: IContractMsgInfo[]) {
    // from list onchain token-ids, get cw721-token records
    const cw721TokenRecords = await this.getCw721TokensRecords(
      listCw721Msgs.map((cw721Msg) => ({
        contractAddress: cw721Msg.contractAddress,
        onchainTokenId: getAttributeFrom(
          cw721Msg.wasm_attributes,
          EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
        ),
      }))
    );
    // from list contract address, get cw721-contract-id
    const Cw721ContractDbRecords = await this.getCw721ContractsRecords(
      listCw721Msgs.map((cw721Msg) => cw721Msg.contractAddress)
    );
    // insert new cw721 activity
    const CW721Activities = listCw721Msgs.map((cw721Msg) => {
      const cw721ContractId = Cw721ContractDbRecords.find(
        (item) => item.address === cw721Msg.contractAddress
      )?.id;
      const onchainTokenId = getAttributeFrom(
        cw721Msg.wasm_attributes,
        EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
      );
      let cw721TokenId = null;
      if (onchainTokenId) {
        const foundRecord = cw721TokenRecords.find(
          (item) =>
            item.contract_address === cw721Msg.contractAddress &&
            item.token_id === onchainTokenId
        );
        if (foundRecord) {
          cw721TokenId = foundRecord.cw721_token_id;
        } else {
          this.logger.error(
            `From tx ${cw721Msg.tx.hash}: Token ${onchainTokenId} in smart contract ${cw721Msg.contractAddress} not found in DB`
          );
        }
      }
      return CW721Activity.fromJson({
        action: cw721Msg.action,
        sender: cw721Msg.sender,
        tx_hash: cw721Msg.tx.hash,
        cw721_contract_id: cw721ContractId,
        cw721_token_id: cw721TokenId,
        height: cw721Msg.tx.height,
      });
    });
    if (CW721Activities.length > 0) {
      await CW721Activity.query().insert(CW721Activities);
    }
  }

  // handle Instantiate Msgs
  async handleInstantiateMsgs(msgsInstantiate: IContractMsgInfo[]) {
    const cw721Contracts: any[] = await SmartContract.query()
      .alias('contract')
      .withGraphJoined('code')
      .whereIn(
        'contract.address',
        msgsInstantiate.map((msg) => msg.contractAddress)
      )
      .andWhere('code.type', 'CW721')
      .select(
        'contract.address as contract_address',
        'contract.name as contract_name',
        'code.code_id as code_id',
        'contract.id as id'
      );
    if (cw721Contracts.length > 0) {
      const contractsInfo = await this.getContractsInfo(
        cw721Contracts.map((cw721Contract) => cw721Contract.contract_address)
      );
      const instantiateContracts = cw721Contracts.map((cw721Contract) => {
        const contractInfo = contractsInfo.find(
          (result) => result.address === cw721Contract.contract_address
        );
        return CW721Contract.fromJson({
          contract_id: cw721Contract.id,
          symbol: contractInfo?.symbol,
          minter: contractInfo?.minter,
        });
      });
      await CW721Contract.query()
        .insert(instantiateContracts)
        .onConflict('contract_id')
        .merge();
    }
  }

  // handle Cw721 Msg Execute
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

  // init enviroment variable before start service
  async initEnv() {
    // DB -> Config -> MinDB
    // Get handled blocks from db
    let blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
    });
    if (!blockCheckpoint) {
      // min Tx from DB
      const minBlock = await Block.query()
        .limit(1)
        .orderBy('height', 'ASC')
        .first()
        .throwIfNotFound();
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
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

  // From list of tokens, get those appropriate ids in DB
  async getCw721TokensRecords(
    tokens: { contractAddress: string; onchainTokenId: string }[]
  ) {
    return CW721Token.query()
      .alias('cw721_token')
      .withGraphJoined('contract.smart_contract')
      .whereIn(
        ['contract:smart_contract.address', 'cw721_token.token_id'],
        tokens
          .map((token) => ({
            contract_address: token.contractAddress,
            token_id: token.onchainTokenId,
          }))
          .filter((token) => token.token_id)
          .map(({ contract_address, token_id }) => [contract_address, token_id])
      )
      .select(
        'contract:smart_contract.address as contract_address',
        'cw721_token.token_id as token_id',
        'cw721_token.id as cw721_token_id'
      );
  }

  // from list contract addresses, get those appopriate records in DB
  async getCw721ContractsRecords(addresses: string[]) {
    return CW721Contract.query()
      .alias('cw721_contract')
      .withGraphJoined('smart_contract')
      .whereIn('smart_contract.address', addresses)
      .select('smart_contract.address as address', 'cw721_contract.id as id');
  }

  // get contract info (minter, symbol, name) by query rpc
  async getContractsInfo(
    contractAddresses: string[]
  ): Promise<IContractInfoAndMinter[]> {
    const promisesInfo: any[] = [];
    const promisesMinter: any[] = [];
    contractAddresses.forEach((address: string) => {
      promisesInfo.push(
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
    contractAddresses.forEach((address: string) => {
      promisesMinter.push(
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
    const contractsInfo = [];
    const resultsContractsInfo: JsonRpcSuccessResponse[] = await Promise.all(
      promisesInfo
    );
    const resultsMinters: JsonRpcSuccessResponse[] = await Promise.all(
      promisesMinter
    );
    for (let index = 0; index < resultsContractsInfo.length; index += 1) {
      const contractInfo = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(resultsContractsInfo[index].result.response.value)
          ).data
        )
      );
      const { minter }: { minter: string } = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(resultsMinters[index].result.response.value)
          ).data
        )
      );
      contractsInfo.push({
        address: contractAddresses[index],
        name: contractInfo.name as string,
        symbol: contractInfo.symbol as string,
        minter,
      });
    }
    return contractsInfo;
  }
}

import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  SERVICE,
  getHttpBatchClient,
  Config,
} from '../../common';
import {
  Block,
  BlockCheckpoint,
  EventAttribute,
  SmartContract,
  Transaction,
} from '../../models';

const { NODE_ENV } = Config;
// const CW20_ACTION = {
//   MINT: 'mint',
//   BURN: 'burn',
//   TRANSFER: 'transfer',
//   INSTANTIATE: 'instantiate',
// };

interface IContractMsgInfo {
  sender: string;
  contractAddress: string;
  action?: string;
  content: string;
  wasm_attributes?: {
    key: string;
    value: string;
  }[];
  tx: Transaction;
  index: number;
  event_id: number;
}
@Service({
  name: SERVICE.V1.Cw20.key,
  version: 1,
})
export default class Cw20Service extends BullableService {
  _httpBatchClient!: HttpBatchClient;

  _blocksPerBatch!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  // Insert new token if it haven't been in cw721_token table, or update burned to false if it already have been there
  async handlerCw721Mint(mintMsgs: IContractMsgInfo[]): Promise<void> {
    if (mintMsgs.length > 0) {
      // from list contract address, get those ids
      const cw721ContractDbRecords = await this.getCw721ContractsRecords(
        mintMsgs.map((cw721Msg) => cw721Msg.contractAddress)
      );
      const newTokens = mintMsgs.map((mintMsg) => {
        const tokenId = this.getAttributeFrom(
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
          owner: this.getAttributeFrom(
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

  // from list contract addresses, get those appopriate records in DB, key by its contract_address
  async getContractByAddress(addresses: string[]) {
    const smartContractRecords = await SmartContract.query()
      .whereIn('smart_contract.address', addresses)
      .select('id', 'address');
    return _.keyBy(smartContractRecords, (contract) => contract.address);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW20,
    jobName: BULL_JOB_NAME.HANDLE_CW20,
  })
  async jobHandleCw20() {
    // get range txs for proccessing
    const [startBlock, endBlock] = await this.getRangeProcessing();
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    // if (endBlock >= startBlock) {
    // }
  }

  // get range blocks for proccessing
  async getRangeProcessing() {
    // DB -> Config -> MinDB
    // Get handled blocks from db
    let blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.HANDLE_CW20,
    });
    if (!blockCheckpoint) {
      // min Tx from DB
      const minBlock = await Block.query()
        .limit(1)
        .orderBy('height', 'ASC')
        .first()
        .throwIfNotFound();
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.HANDLE_CW20,
        height: config.cw20.startBlock
          ? config.cw20.startBlock
          : minBlock.height,
      });
    }
    const startBlock: number = blockCheckpoint.height;
    const latestBlock = await Block.query()
      .limit(1)
      .orderBy('height', 'DESC')
      .first()
      .throwIfNotFound();
    const endBlock: number = Math.min(
      startBlock + this._blocksPerBatch,
      latestBlock.height
    );
    return [startBlock, endBlock];
  }

  async _start(): Promise<void> {
    this._httpBatchClient = getHttpBatchClient();
    this._blocksPerBatch = config.cw20.blocksPerBatch
      ? config.cw20.blocksPerBatch
      : 100;
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.HANDLE_CW20,
        BULL_JOB_NAME.HANDLE_CW20,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.cw20.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }
}

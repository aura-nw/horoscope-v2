import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { SmartContractEvent } from 'src/models/smart_contract_event';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  BULL_JOB_NAME,
  SERVICE,
  getHttpBatchClient,
  Config,
} from '../../common';
import { EventAttribute, SmartContract } from '../../models';

const { NODE_ENV } = Config;
// const CW20_ACTION = {
//   MINT: 'mint',
//   BURN: 'burn',
//   TRANSFER: 'transfer',
//   INSTANTIATE: 'instantiate',
// };

@Service({
  name: SERVICE.V1.Cw20.key,
  version: 1,
})
export default class Cw20Service extends BullableService {
  _httpBatchClient!: HttpBatchClient;

  _blocksPerBatch!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  // Insert new token if it haven't been in cw721_token table, or update burned to false if it already have been there
  async handlerCw721Mint(mintEvents: SmartContractEvent[]): Promise<void> {
    if (mintEvents.length > 0) {
      // from list contract address, get those ids
      const cw721ContractDbRecords = await this.getCw721ContractsRecords(
        mintEvents.map((cw721Msg) => cw721Msg.contractAddress)
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
  async jobHandleCw20(): Promise<void> {
    // // get range txs for proccessing
    // const [startBlock, endBlock, updateBlockCheckpoint] =
    //   await BlockCheckpoint.getCheckpoint(
    //     BULL_JOB_NAME.HANDLE_CW20,
    //     [BULL_JOB_NAME.CRAWL_SMART_CONTRACT],
    //     config.crawlContractEvent.key
    //   );
    // this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    // if (startBlock >= endBlock) return;
    // // get all contract Msg in above range blocks
    // const cw20Events = await this.getCw20ContractEvents(startBlock, endBlock);
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
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

  async getCw20ContractEvents(startBlock: number, endBlock: number) {
    return SmartContractEvent.query()
      .alias('smart_contract_event')
      .withGraphJoined(
        '[message(selectMessage), tx(selectTransaction), attributes(selectAttribute), smart_contract(selectSmartContract).code(selectCode)]'
      )
      .modifiers({
        selectCode(builder) {
          builder.select('type');
        },
        selectTransaction(builder) {
          builder.select('hash', 'height');
        },
        selectMessage(builder) {
          builder.select('sender');
        },
        selectAttribute(builder) {
          builder.select('key', 'value');
        },
        selectSmartContract(builder) {
          builder.select('address');
        },
      })
      .where('smart_contract:code.type', 'CW20')
      .where('tx.height', '>', startBlock)
      .andWhere('tx.height', '<=', endBlock)
      .select(
        'message.sender as sender',
        'smart_contract.address as contractAddress',
        'smart_contract_event.action',
        'smart_contract_event.event_id',
        'smart_contract_event.index'
      );
  }
}

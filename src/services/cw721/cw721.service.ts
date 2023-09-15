import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import _, { Dictionary } from 'lodash';
import { Context, ServiceBroker } from 'moleculer';
import { Queue } from 'bullmq';
import { Knex } from 'knex';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  Config,
  IContextReindexingServiceHistory,
  getHttpBatchClient,
} from '../../common';
import { BULL_JOB_NAME, SERVICE } from '../../common/constant';
import knex from '../../common/utils/db_connection';
import { getAttributeFrom } from '../../common/utils/smart_contract';
import { Block, BlockCheckpoint, EventAttribute } from '../../models';
import CW721Contract from '../../models/cw721_contract';
import CW721ContractStats from '../../models/cw721_stats';
import CW721Token from '../../models/cw721_token';
import CW721Activity from '../../models/cw721_tx';
import { SmartContract } from '../../models/smart_contract';
import { SmartContractEvent } from '../../models/smart_contract_event';

const { NODE_ENV } = Config;

export const CW721_ACTION = {
  MINT: 'mint',
  BURN: 'burn',
  TRANSFER: 'transfer_nft',
  INSTANTIATE: 'instantiate',
  SEND_NFT: 'send_nft',
};

export interface ICw721ReindexingHistoryParams {
  smartContractId: number;
  startBlock: number;
  endBlock: number;
  prevId: number;
  contractAddress: string;
  tokensKeyBy: Dictionary<CW721Token>;
  cw721ContractKeyBy: Dictionary<CW721Contract>;
}
@Service({
  name: SERVICE.V1.Cw721.key,
  version: 1,
})
export default class Cw721HandlerService extends BullableService {
  _httpBatchClient!: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  // update new owner and last_update_height
  handlerCw721Transfer(
    transferMsg: SmartContractEvent,
    tokens: Dictionary<CW721Token>,
    cw721Activities: CW721Activity[],
    cw721ContractId: number
  ) {
    const recipient = getAttributeFrom(
      transferMsg.attributes,
      EventAttribute.ATTRIBUTE_KEY.RECIPIENT
    );
    const tokenId = getAttributeFrom(
      transferMsg.attributes,
      EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
    );
    const token = tokens[`${transferMsg.contractAddress}_${tokenId}`];
    if (
      token !== undefined &&
      token.last_updated_height <= transferMsg.height
    ) {
      cw721Activities.push(
        CW721Activity.fromJson({
          action: transferMsg.action,
          sender: getAttributeFrom(
            transferMsg.attributes,
            EventAttribute.ATTRIBUTE_KEY.SENDER
          ),
          tx_hash: transferMsg.hash,
          cw721_contract_id: cw721ContractId,
          height: transferMsg.height,
          smart_contract_event_id: transferMsg.smart_contract_event_id,
          from: token.owner,
          to: recipient,
          token_id: tokenId,
        })
      );
      token.owner = recipient;
      token.last_updated_height = transferMsg.height;
    }
  }

  // Insert new token if it haven't been in cw721_token table, or update burned to false if it already have been there
  handlerCw721Mint(
    mintEvent: SmartContractEvent,
    tokens: Dictionary<CW721Token>,
    cw721Activities: CW721Activity[],
    cw721ContractId: number
  ) {
    const tokenId = getAttributeFrom(
      mintEvent.attributes,
      EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
    );
    const token = tokens[`${mintEvent.contractAddress}_${tokenId}`];
    if (token === undefined || token.last_updated_height <= mintEvent.height) {
      const mediaInfo = null;
      // eslint-disable-next-line no-param-reassign
      tokens[`${mintEvent.contractAddress}_${tokenId}`] = CW721Token.fromJson({
        token_id: tokenId,
        media_info: mediaInfo,
        owner: getAttributeFrom(
          mintEvent.attributes,
          EventAttribute.ATTRIBUTE_KEY.OWNER
        ),
        cw721_contract_id: cw721ContractId,
        last_updated_height: mintEvent.height,
        burned: false,
        id: token === undefined ? undefined : token.id,
      });
      cw721Activities.push(
        CW721Activity.fromJson({
          action: mintEvent.action,
          sender: getAttributeFrom(
            mintEvent.attributes,
            EventAttribute.ATTRIBUTE_KEY.MINTER
          ),
          tx_hash: mintEvent.hash,
          cw721_contract_id: cw721ContractId,
          height: mintEvent.height,
          smart_contract_event_id: mintEvent.smart_contract_event_id,
          from: null,
          to: getAttributeFrom(
            mintEvent.attributes,
            EventAttribute.ATTRIBUTE_KEY.OWNER
          ),
          token_id: tokenId,
        })
      );
    }
  }

  // update burned field in cw721_token to true, last updated height
  handlerCw721Burn(
    burnMsg: SmartContractEvent,
    tokens: Dictionary<CW721Token>,
    cw721Activities: CW721Activity[],
    cw721ContractId: number
  ) {
    const tokenId = getAttributeFrom(
      burnMsg.attributes,
      EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
    );
    const token = tokens[`${burnMsg.contractAddress}_${tokenId}`];
    if (token !== undefined && token.last_updated_height <= burnMsg.height) {
      cw721Activities.push(
        CW721Activity.fromJson({
          action: burnMsg.action,
          sender: getAttributeFrom(
            burnMsg.attributes,
            EventAttribute.ATTRIBUTE_KEY.SENDER
          ),
          tx_hash: burnMsg.hash,
          cw721_contract_id: cw721ContractId,
          height: burnMsg.height,
          smart_contract_event_id: burnMsg.smart_contract_event_id,
          from: token.owner,
          to: null,
          token_id: tokenId,
        })
      );
      token.burned = true;
      token.last_updated_height = burnMsg.height;
    }
  }

  handleCw721Others(
    msg: SmartContractEvent,
    cw721Activities: CW721Activity[],
    cw721ContractId: number
  ) {
    const tokenId = getAttributeFrom(
      msg.attributes,
      EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
    );
    cw721Activities.push(
      CW721Activity.fromJson({
        action: msg.action,
        sender: getAttributeFrom(
          msg.attributes,
          EventAttribute.ATTRIBUTE_KEY.SENDER
        ),
        tx_hash: msg.hash,
        cw721_contract_id: cw721ContractId,
        height: msg.height,
        smart_contract_event_id: msg.smart_contract_event_id,
        token_id: tokenId,
      })
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
    jobName: BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
  })
  async jobHandler(): Promise<void> {
    await this.handleJob();
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
      await this.createJob(
        BULL_JOB_NAME.REFRESH_CW721_STATS,
        BULL_JOB_NAME.REFRESH_CW721_STATS,
        {},
        {
          removeOnComplete: { count: 1 },
          removeOnFail: {
            count: 3,
          },
          repeat: {
            pattern: config.cw721.timeRefreshCw721Stats,
          },
        }
      );
    }
    return super._start();
  }

  // main function
  async handleJob() {
    // get range blocks for proccessing
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
        [BULL_JOB_NAME.CRAWL_CONTRACT_EVENT],
        config.cw721.key
      );
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    if (startBlock >= endBlock) return;
    // get all contract Msg in above range blocks
    const listContractMsg = await this.getCw721ContractEvents(
      startBlock,
      endBlock
    );
    this.logger.info(listContractMsg);
    await knex.transaction(async (trx) => {
      if (listContractMsg.length > 0) {
        const cw721Activities: CW721Activity[] = [];
        // handle instantiate cw721 contracts
        await this.handleInstantiateMsgs(
          listContractMsg.filter(
            (msg) => msg.action === CW721_ACTION.INSTANTIATE
          ),
          trx
        );
        // handle all cw721 execute messages
        await this.handleCw721MsgExec(listContractMsg, cw721Activities, trx);
        await CW721Activity.query()
          .transacting(trx)
          .insert(cw721Activities.map((e) => _.omit(e, 'token_id')));
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  // handle Instantiate Msgs
  async handleInstantiateMsgs(
    msgsInstantiate: SmartContractEvent[],
    trx: Knex.Transaction
  ) {
    const cw721Contracts: any[] = await SmartContract.query()
      .transacting(trx)
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
        'contract.id as id'
      );
    if (cw721Contracts.length > 0) {
      const contractsInfo = _.keyBy(
        await CW721Contract.getContractsInfo(
          cw721Contracts.map((cw721Contract) => cw721Contract.contract_address)
        ),
        'address'
      );
      const instantiateContracts = cw721Contracts.map((cw721Contract) => {
        const contractInfo = contractsInfo[cw721Contract.contract_address];
        return CW721Contract.fromJson({
          contract_id: cw721Contract.id,
          symbol: contractInfo?.symbol,
          minter: contractInfo?.minter,
          name: contractInfo?.name,
          track: true,
        });
      });
      await CW721Contract.query().transacting(trx).insert(instantiateContracts);
    }
  }

  // handle Cw721 Msg Execute
  async handleCw721MsgExec(
    cw721MsgsExecute: SmartContractEvent[],
    cw721Activities: CW721Activity[],
    trx: Knex.Transaction
  ) {
    const tokensKeyBy = _.keyBy(
      await CW721Token.query()
        .transacting(trx)
        .withGraphJoined('contract.smart_contract')
        .whereIn(
          ['contract:smart_contract.address', 'token_id'],
          cw721MsgsExecute.map((msg) => [
            msg.contractAddress,
            getAttributeFrom(
              msg.attributes,
              EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
            ),
          ])
        ),
      (o) => `${o.contract.smart_contract.address}_${o.token_id}`
    );
    const trackedCw721ContractsByAddr = _.keyBy(
      await this.getCw721TrackedContracts(
        cw721MsgsExecute.map((msg) => msg.contractAddress),
        trx
      ),
      'address'
    );
    this.updateActivitiesAndTokens(
      cw721MsgsExecute,
      cw721Activities,
      tokensKeyBy,
      trackedCw721ContractsByAddr
    );
    const updatedTokens = Object.values(tokensKeyBy);
    if (updatedTokens.length > 0) {
      const tokens = await CW721Token.query()
        .transacting(trx)
        .insert(updatedTokens)
        .onConflict('id')
        .merge();
      const tokensKeyById: Dictionary<CW721Token> = _.keyBy(
        tokens,
        (o) => `${o.cw721_contract_id}_${o.token_id}`
      );
      cw721Activities.forEach((act) => {
        const token = tokensKeyById[`${act.cw721_contract_id}_${act.token_id}`];
        // eslint-disable-next-line no-param-reassign
        act.cw721_token_id = token?.id;
      });
    }
  }

  updateActivitiesAndTokens(
    cw721Msgs: SmartContractEvent[],
    cw721Activities: CW721Activity[],
    tokensKeyBy: Dictionary<CW721Token>,
    trackedCw721ContractsByAddr: Dictionary<CW721Contract>
  ) {
    cw721Msgs.forEach((msg) => {
      const cw721Contract = trackedCw721ContractsByAddr[msg.contractAddress];
      // check token is in tracked cw721 contract
      if (cw721Contract) {
        if (msg.action === CW721_ACTION.MINT) {
          this.handlerCw721Mint(
            msg,
            tokensKeyBy,
            cw721Activities,
            cw721Contract.id
          );
        } else if (
          msg.action === CW721_ACTION.TRANSFER ||
          msg.action === CW721_ACTION.SEND_NFT
        ) {
          this.handlerCw721Transfer(
            msg,
            tokensKeyBy,
            cw721Activities,
            cw721Contract.id
          );
        } else if (msg.action === CW721_ACTION.BURN) {
          this.handlerCw721Burn(
            msg,
            tokensKeyBy,
            cw721Activities,
            cw721Contract.id
          );
        } else {
          this.handleCw721Others(msg, cw721Activities, cw721Contract.id);
        }
      }
    });
  }

  // from list contract addresses, get those appopriate records in DB
  async getCw721TrackedContracts(addresses: string[], trx: Knex.Transaction) {
    return CW721Contract.query()
      .transacting(trx)
      .alias('cw721_contract')
      .withGraphJoined('smart_contract')
      .whereIn('smart_contract.address', addresses)
      .andWhere('track', true)
      .select('smart_contract.address as address', 'cw721_contract.id as id');
  }

  async getCw721ContractEvents(
    startBlock: number,
    endBlock: number,
    smartContractId?: number,
    page?: { prevId: number; limit: number }
  ) {
    return SmartContractEvent.query()
      .withGraphFetched('attributes(selectAttribute)')
      .joinRelated('[message, tx, smart_contract.code]')
      .where('smart_contract:code.type', 'CW721')
      .where('tx.height', '>', startBlock)
      .andWhere('tx.height', '<=', endBlock)
      .modify((builder) => {
        if (smartContractId) {
          builder.andWhere('smart_contract.id', smartContractId);
        }
        if (page) {
          builder
            .andWhere('smart_contract_event.id', '>', page.prevId)
            .orderBy('smart_contract_event.id', 'asc')
            .limit(page.limit);
        }
      })
      .select(
        'message.sender as sender',
        'smart_contract.address as contractAddress',
        'smart_contract_event.action',
        'smart_contract_event.event_id',
        'smart_contract_event.index',
        'smart_contract_event.id as smart_contract_event_id',
        'tx.hash',
        'tx.height'
      )
      .orderBy('smart_contract_event.id');
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.REFRESH_CW721_STATS,
    jobName: BULL_JOB_NAME.REFRESH_CW721_STATS,
  })
  async jobHandlerRefresh(): Promise<void> {
    await this.refreshCw721Stats();
  }

  async refreshCw721Stats(): Promise<void> {
    const cw721Stats = await this.calCw721Stats();

    // Upsert cw721 stats
    await CW721ContractStats.query()
      .insert(cw721Stats)
      .onConflict('cw721_contract_id')
      .merge()
      .returning('id');
  }

  async calCw721Stats(): Promise<CW721Contract[]> {
    // Get once block height 24h ago.
    const blockSince24hAgo = await Block.query()
      .select('height')
      .where('time', '<=', knex.raw("now() - '24 hours'::interval"))
      .orderBy('height', 'desc')
      .limit(1);

    // Calculate total activity and transfer_24h of cw721
    return CW721Contract.query()
      .count('cw721_activity.id AS total_activity')
      .select(
        knex.raw(
          "SUM( CASE WHEN cw721_activity.height >= ? AND cw721_activity.action != 'instantiate' THEN 1 ELSE 0 END ) AS transfer_24h",
          blockSince24hAgo[0]?.height
        )
      )
      .select('cw721_contract.id as cw721_contract_id')
      .where('cw721_contract.track', '=', true)
      .andWhere('smart_contract.name', '!=', 'crates.io:cw4973')
      .andWhere('cw721_activity.action', '!=', '')
      .join(
        'cw721_activity',
        'cw721_contract.id',
        'cw721_activity.cw721_contract_id'
      )
      .join('smart_contract', 'cw721_contract.contract_id', 'smart_contract.id')
      .groupBy('cw721_contract.id');
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.REINDEX_CW721_HISTORY,
    jobName: BULL_JOB_NAME.REINDEX_CW721_HISTORY,
  })
  public async crawlMissingContractHistory(
    _payload: ICw721ReindexingHistoryParams
  ) {
    const {
      cw721ContractKeyBy,
      startBlock,
      endBlock,
      prevId,
      contractAddress,
      tokensKeyBy,
      smartContractId,
    } = _payload;
    // insert data from event_attribute_backup to event_attribute
    const { limitRecordGet } = config.cw721.reindexing;
    const events = await this.getCw721ContractEvents(
      startBlock,
      endBlock,
      smartContractId,
      { limit: limitRecordGet, prevId }
    );
    if (events.length > 0) {
      const cw721Activities: CW721Activity[] = [];
      this.updateActivitiesAndTokens(
        events,
        cw721Activities,
        tokensKeyBy,
        cw721ContractKeyBy
      );
      if (cw721Activities.length > 0) {
        await CW721Activity.query().insert(
          cw721Activities.map((e) => _.omit(e, 'token_id'))
        );
      }
      await this.createJob(
        BULL_JOB_NAME.REINDEX_CW721_HISTORY,
        BULL_JOB_NAME.REINDEX_CW721_HISTORY,
        {
          smartContractId,
          startBlock,
          endBlock,
          prevId: events[events.length - 1].smart_contract_event_id,
          contractAddress,
          cw721ContractKeyBy,
          tokensKeyBy,
        } satisfies ICw721ReindexingHistoryParams,
        {
          removeOnComplete: true,
        }
      );
    } else {
      const queue: Queue = this.getQueueManager().getQueue(
        BULL_JOB_NAME.REINDEX_CW721_CONTRACT
      );
      await queue.remove(contractAddress);
      this.logger.info('Reindex cw721 history done!!!');
    }
  }

  @Action({
    name: SERVICE.V1.Cw721.HandleRangeBlockMissingContract.key,
    params: {
      smartContractId: 'any',
      startBlock: 'any',
      endBlock: ' any',
    },
  })
  public async handleRangeBlockMissingContract(
    ctx: Context<IContextReindexingServiceHistory>
  ) {
    const { smartContractId, startBlock, endBlock } = ctx.params;
    const missingHistories = await this.getCw721ContractEvents(
      startBlock,
      endBlock,
      smartContractId
    );
    const cw721Activities: CW721Activity[] = [];
    await knex.transaction(async (trx) => {
      // handle all cw721 execute messages
      await this.handleCw721MsgExec(
        missingHistories.filter(
          (history) => history.action !== CW721_ACTION.MINT
        ),
        cw721Activities,
        trx
      );
      if (cw721Activities.length > 0) {
        await CW721Activity.query()
          .transacting(trx)
          .insert(cw721Activities.map((e) => _.omit(e, 'token_id')));
      }
    });
  }
}

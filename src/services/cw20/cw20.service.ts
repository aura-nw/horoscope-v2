import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Queue } from 'bullmq';
import { Knex } from 'knex';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  IContextUpdateCw20,
  SERVICE,
} from '../../common';
import knex from '../../common/utils/db_connection';
import { getAttributeFrom } from '../../common/utils/smart_contract';
import {
  Block,
  BlockCheckpoint,
  CW20TotalHolderStats,
  Cw20Contract,
  Cw20Activity,
  EventAttribute,
  IHolderEvent,
} from '../../models';
import { SmartContractEvent } from '../../models/smart_contract_event';

const { NODE_ENV } = Config;
export const CW20_ACTION = {
  MINT: 'mint',
  BURN: 'burn',
  TRANSFER: 'transfer',
  INSTANTIATE: 'instantiate',
  SEND: 'send',
  TRANSFER_FROM: 'transfer_from',
  BURN_FROM: 'burn_from',
  SEND_FROM: 'send_from',
};
export interface ICw20ReindexingHistoryParams {
  smartContractId: number;
  startBlock: number;
  endBlock: number;
  prevId: number;
  contractAddress: string;
}
@Service({
  name: SERVICE.V1.Cw20.key,
  version: 1,
})
export default class Cw20Service extends BullableService {
  _blocksPerBatch!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW20,
    jobName: BULL_JOB_NAME.HANDLE_CW20,
  })
  async jobHandleCw20(): Promise<void> {
    // get range txs for proccessing
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_CW20,
        [BULL_JOB_NAME.CRAWL_CONTRACT_EVENT],
        config.cw20.key
      );
    await this.handleStatistic(startBlock);
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    if (startBlock >= endBlock) return;
    // get all contract Msg in above range blocks
    const cw20Events = await this.getCw20ContractEvents(startBlock, endBlock);
    this.logger.info(cw20Events);
    await knex.transaction(async (trx) => {
      if (cw20Events.length > 0) {
        // handle instantiate cw20 contracts
        await this.handleCw20Instantiate(
          cw20Events.filter(
            (event) => event.action === CW20_ACTION.INSTANTIATE
          ),
          trx
        );
        // handle Cw20 Histories
        await this.handleCw20Histories(cw20Events, trx);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
    const cw20Contracts = await Cw20Contract.query()
      .alias('cw20_contract')
      .withGraphJoined('smart_contract')
      .whereIn(
        'smart_contract.address',
        cw20Events.map((event) => event.contract_address)
      )
      .andWhere('track', true)
      .select(['cw20_contract.id', 'last_updated_height']);
    await this.broker.call(
      SERVICE.V1.Cw20UpdateByContract.UpdateByContract.path,
      {
        cw20Contracts,
        startBlock,
        endBlock,
      } satisfies IContextUpdateCw20
    );
  }

  // insert new cw20 contract + instantiate holders
  async handleCw20Instantiate(
    cw20InstantiateEvents: SmartContractEvent[],
    trx: Knex.Transaction
  ) {
    if (cw20InstantiateEvents.length > 0) {
      const contractsInfo = await Cw20Contract.getContractsInfo(
        cw20InstantiateEvents.map((event) => event.contract_address)
      );
      const instantiateContracts = await Promise.all(
        cw20InstantiateEvents.map(async (event) => {
          const contractInfo = contractsInfo.find(
            (result) => result.address === event.contract_address
          );
          let track = true;
          let initBalances: IHolderEvent[] = [];
          // get init address holder, init amount
          try {
            initBalances = await Cw20Contract.getInstantiateBalances(
              event.contract_address
            );
          } catch (error) {
            track = false;
          }
          const lastUpdatedHeight =
            initBalances.length > 0
              ? Math.min(...initBalances.map((e) => e.event_height))
              : 0;
          return {
            ...Cw20Contract.fromJson({
              smart_contract_id: event.smart_contract_id,
              symbol: contractInfo?.symbol,
              minter: contractInfo?.minter,
              marketing_info: contractInfo?.marketing_info,
              name: contractInfo?.name,
              total_supply: initBalances.reduce(
                (acc: string, curr: { address: string; amount: string }) =>
                  (BigInt(acc) + BigInt(curr.amount)).toString(),
                '0'
              ),
              track,
              decimal: contractInfo?.decimal,
              last_updated_height: lastUpdatedHeight,
              smart_contract_address: event.contract_address,
            }),
            holders: initBalances.map((e) => ({
              address: e.address,
              amount: e.amount,
              last_updated_height: e.event_height,
            })),
          };
        })
      );
      await Cw20Contract.query()
        .insertGraph(instantiateContracts)
        .transacting(trx);
    }
  }

  async handleCw20Histories(
    cw20Events: SmartContractEvent[],
    trx: Knex.Transaction
  ) {
    // get all related cw20_contract in DB for updating total_supply
    const cw20Contracts = await Cw20Contract.query()
      .transacting(trx)
      .withGraphJoined('smart_contract')
      .whereIn(
        'smart_contract.address',
        cw20Events.map((event) => event.contract_address)
      )
      .andWhere('track', true);
    const cw20ContractsByAddress = _.keyBy(
      cw20Contracts,
      (e) => `${e.smart_contract.address}`
    );
    // insert new histories
    const newHistories = cw20Events
      .filter((event) => cw20ContractsByAddress[event.contract_address]?.id)
      .map((event) =>
        Cw20Activity.fromJson({
          smart_contract_event_id: event.smart_contract_event_id,
          sender: event.message.sender,
          action: event.action,
          cw20_contract_id: cw20ContractsByAddress[event.contract_address].id,
          amount: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.AMOUNT
          ),
          from: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.FROM
          ),
          to: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.TO
          ),
          height: event.height,
          tx_hash: event.hash,
        })
      );
    if (newHistories.length > 0) {
      await Cw20Activity.query().insert(newHistories).transacting(trx);
    }
  }

  async getCw20ContractEvents(
    startBlock: number,
    endBlock: number,
    smartContractId?: number,
    page?: { prevId: number; limit: number }
  ) {
    return SmartContractEvent.query()
      .withGraphFetched('[message, attributes(selectAttribute)]')
      .joinRelated('[event.transaction, smart_contract.code]')
      .where('smart_contract:code.type', 'CW20')
      .where('event.block_height', '>', startBlock)
      .andWhere('event.block_height', '<=', endBlock)
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
        'smart_contract.address as contract_address',
        'smart_contract_event.action',
        'smart_contract_event.event_id',
        'smart_contract.id as smart_contract_id',
        'smart_contract_event.id as smart_contract_event_id',
        'event:transaction.hash',
        'event:transaction.height'
      )
      .orderBy('smart_contract_event.id', 'asc');
  }

  async handleStatistic(startBlock: number) {
    const systemDate = (
      await Block.query()
        .where('height', startBlock + 1)
        .first()
        .throwIfNotFound()
    ).time;
    const lastUpdatedDate = (
      await CW20TotalHolderStats.query().max('date').first()
    )?.max;
    if (lastUpdatedDate) {
      systemDate.setHours(0, 0, 0, 0);
      lastUpdatedDate.setHours(0, 0, 0, 0);
      if (systemDate > lastUpdatedDate) {
        await this.handleTotalHolderStatistic(systemDate);
      }
    } else {
      await this.handleTotalHolderStatistic(systemDate);
    }
  }

  async handleTotalHolderStatistic(systemDate: Date) {
    const totalHolder = await Cw20Contract.query()
      .joinRelated('holders')
      .where('cw20_contract.track', true)
      .groupBy('cw20_contract.id')
      .select(
        'cw20_contract.id as cw20_contract_id',
        knex.raw(
          'count(CASE when holders.amount > 0 THEN 1 ELSE null END) as count'
        )
      );
    if (totalHolder.length > 0) {
      await CW20TotalHolderStats.query().insert(
        totalHolder.map((e) =>
          CW20TotalHolderStats.fromJson({
            cw20_contract_id: e.cw20_contract_id,
            total_holder: e.count,
            date: systemDate,
          })
        )
      );
    }
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.broker.waitForServices(SERVICE.V1.Cw20UpdateByContract.name);
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.REINDEX_CW20_HISTORY,
    jobName: BULL_JOB_NAME.REINDEX_CW20_HISTORY,
  })
  public async reindexHistory(_payload: ICw20ReindexingHistoryParams) {
    const { smartContractId, startBlock, endBlock, prevId, contractAddress } =
      _payload;
    // insert data from event_attribute_backup to event_attribute
    const { limitRecordGet } = config.cw20.reindexHistory;
    const events = await this.getCw20ContractEvents(
      startBlock,
      endBlock,
      smartContractId,
      { limit: limitRecordGet, prevId }
    );
    if (events.length > 0) {
      await knex.transaction(async (trx) => {
        await this.handleCw20Histories(events, trx);
      });
      await this.createJob(
        BULL_JOB_NAME.REINDEX_CW20_HISTORY,
        BULL_JOB_NAME.REINDEX_CW20_HISTORY,
        {
          smartContractId,
          startBlock,
          endBlock,
          prevId: events[events.length - 1].smart_contract_event_id,
          contractAddress,
        } satisfies ICw20ReindexingHistoryParams,
        {
          removeOnComplete: true,
        }
      );
    } else {
      const queue: Queue = this.getQueueManager().getQueue(
        BULL_JOB_NAME.REINDEX_CW20_CONTRACT
      );
      (await queue.getJob(contractAddress))?.remove();
    }
  }
}

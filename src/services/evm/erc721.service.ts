import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import _, { Dictionary } from 'lodash';
import { Context, ServiceBroker } from 'moleculer';
import { PublicClient, getContract } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import knex from '../../common/utils/db_connection';
import EtherJsClient from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMSmartContract,
  Erc721Activity,
  Erc721Token,
  EvmEvent,
  Erc721Stats,
  Block,
} from '../../models';
import { Erc721Contract } from '../../models/erc721_contract';
import { BULL_JOB_NAME, SERVICE } from './constant';
import {
  ERC721_ACTION,
  ERC721_EVENT_TOPIC0,
  Erc721Handler,
} from './erc721_handler';
import * as Erc721MediaHandler from './erc721_media_handler';

const { NODE_ENV } = Config;
@Service({
  name: SERVICE.V1.Erc721.key,
  version: 1,
})
export default class Erc721Service extends BullableService {
  viemClient!: PublicClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
    jobName: BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
  })
  async handleErc721Contract(): Promise<void> {
    await knex.transaction(async (trx) => {
      // get id evm smart contract checkpoint
      // get range blocks for proccessing
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
          [BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM],
          config.erc721.key
        );
      const erc721SmartContracts = await EVMSmartContract.query()
        .where('created_height', '>', startBlock)
        .andWhere('created_height', '<=', endBlock)
        .andWhere('type', EVMSmartContract.TYPES.ERC721)
        .orderBy('id', 'asc');
      if (erc721SmartContracts.length > 0) {
        const erc721Instances = await this.getErc721Instances(
          erc721SmartContracts
        );
        await Erc721Contract.query().transacting(trx).insert(erc721Instances);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
    jobName: BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
  })
  async handleErc721Activity(): Promise<void> {
    await knex.transaction(async (trx) => {
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
          [
            BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
            BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
          ],
          config.erc721.key
        );
      const erc721Events = await EvmEvent.query()
        .transacting(trx)
        .joinRelated('[evm_smart_contract,evm_transaction]')
        .innerJoin(
          'erc721_contract',
          'evm_event.address',
          'erc721_contract.address'
        )
        .where('evm_event.block_height', '>', startBlock)
        .andWhere('evm_event.block_height', '<=', endBlock)
        .orderBy('evm_event.id', 'asc')
        .select(
          'evm_event.*',
          'evm_transaction.from as sender',
          'evm_smart_contract.id as evm_smart_contract_id',
          'evm_transaction.id as evm_tx_id',
          'erc721_contract.track as track'
        );
      await this.handleMissingErc721Contract(erc721Events, trx);
      const erc721Activities: Erc721Activity[] = [];
      erc721Events
        .filter((e) => e.track)
        .forEach((e) => {
          if (e.topic0 === ERC721_EVENT_TOPIC0.TRANSFER) {
            const activity = Erc721Handler.buildTransferActivity(
              e,
              this.logger
            );
            if (activity) {
              erc721Activities.push(activity);
            }
          } else if (e.topic0 === ERC721_EVENT_TOPIC0.APPROVAL) {
            const activity = Erc721Handler.buildApprovalActivity(
              e,
              this.logger
            );
            if (activity) {
              erc721Activities.push(activity);
            }
          } else if (e.topic0 === ERC721_EVENT_TOPIC0.APPROVAL_FOR_ALL) {
            const activity = Erc721Handler.buildApprovalForAllActivity(
              e,
              this.logger
            );
            if (activity) {
              erc721Activities.push(activity);
            }
          }
        });
      if (erc721Activities.length > 0) {
        const erc721Tokens = _.keyBy(
          await Erc721Token.query()
            .whereIn(
              ['erc721_contract_address', 'token_id'],
              erc721Activities.map((e) => [
                e.erc721_contract_address,
                // if token_id undefined (case approval_all), replace by null => not get any token (because token must have token_id)
                e.token_id || null,
              ])
            )
            .transacting(trx),
          (o) => `${o.erc721_contract_address}_${o.token_id}`
        );
        const erc721Handler = new Erc721Handler(erc721Tokens, erc721Activities);
        erc721Handler.process();
        await this.updateErc721(
          erc721Activities,
          Object.values(erc721Handler.erc721Tokens),
          trx
        );
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC721_MEDIA,
    jobName: BULL_JOB_NAME.HANDLE_ERC721_MEDIA,
  })
  async handleErc721Media(): Promise<void> {
    // get id token checkpoint
    const tokenCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.HANDLE_ERC721_MEDIA,
    });
    const idTokenCheckpoint = tokenCheckpoint?.height || 0;
    const tokensUnprocess = await Erc721Token.query()
      .where('media_info', null)
      .andWhere('id', '>', idTokenCheckpoint)
      .orderBy('id', 'ASC')
      .limit(config.erc721.mediaPerBatch);
    if (tokensUnprocess.length > 0) {
      this.logger.info(
        `from id (token) ${tokensUnprocess[0].id} to id (token) ${
          tokensUnprocess[tokensUnprocess.length - 1].id
        }`
      );
      // get batch token_uri before start processing for each
      const tokensMediaInfo = await this.getTokensUri(tokensUnprocess);
      await Promise.all(
        tokensMediaInfo.map((tokenMedia) =>
          this.createJob(
            BULL_JOB_NAME.HANDLE_ERC721_TOKEN_MEDIA,
            BULL_JOB_NAME.HANDLE_ERC721_TOKEN_MEDIA,
            { tokenMedia },
            {
              removeOnComplete: true,
              removeOnFail: {
                count: 3,
              },
              jobId: `${tokenMedia.address}_${tokenMedia.erc721_token_id}`,
            }
          )
        )
      );
      await BlockCheckpoint.query()
        .insert({
          job_name: BULL_JOB_NAME.HANDLE_ERC721_MEDIA,
          height: tokensUnprocess[tokensUnprocess.length - 1].id,
        })
        .onConflict(['job_name'])
        .merge();
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC721_TOKEN_MEDIA,
    jobName: BULL_JOB_NAME.HANDLE_ERC721_TOKEN_MEDIA,
    concurrency: config.erc721.concurrencyHandleTokenMedia,
  })
  async jobHandlerTokenMedia(_payload: {
    tokenMedia: Erc721MediaHandler.ITokenMediaInfo;
  }) {
    let { tokenMedia } = _payload;
    if (tokenMedia.onchain.token_uri) {
      try {
        // update metadata
        tokenMedia.onchain.metadata = await Erc721MediaHandler.getMetadata(
          tokenMedia.onchain.token_uri
        );
      } catch (error) {
        this.logger.error(error);
        throw error;
      }
    }
    // upload & update link s3
    tokenMedia = await Erc721MediaHandler.updateMediaS3(
      tokenMedia,
      this.logger
    );
    this.logger.info(tokenMedia);
    await Erc721Token.query()
      .where('id', tokenMedia.erc721_token_id)
      .patch({
        media_info: {
          onchain: {
            token_uri: tokenMedia.onchain.token_uri,
            metadata: tokenMedia.onchain.metadata,
          },
          offchain: tokenMedia.offchain,
        },
      });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.REFRESH_ERC721_STATS,
    jobName: BULL_JOB_NAME.REFRESH_ERC721_STATS,
  })
  async jobHandlerRefresh(): Promise<void> {
    const erc721Stats = await this.calErc721Stats();
    // Upsert erc721 stats
    await Erc721Stats.query()
      .insert(
        erc721Stats.map((e) =>
          Erc721Stats.fromJson({
            total_activity: e.total_activity,
            transfer_24h: e.transfer_24h,
            erc721_contract_id: e.erc721_contract_id,
          })
        )
      )
      .onConflict('erc721_contract_id')
      .merge()
      .returning('id');
  }

  @Action({
    name: SERVICE.V1.Erc721.insertNewErc721Contracts.key,
    params: {
      evmSmartContracts: 'any[]',
    },
  })
  async insertNewErc721Contracts(
    ctx: Context<{
      evmSmartContracts: {
        id: number;
        address: string;
      }[];
    }>
  ) {
    const { evmSmartContracts } = ctx.params;
    if (evmSmartContracts.length > 0) {
      const currentHeight = await this.viemClient.getBlockNumber();
      const erc721Instances = await this.getErc721Instances(
        evmSmartContracts.map((e) =>
          EVMSmartContract.fromJson({
            ...e,
            created_height: currentHeight.toString(),
          })
        )
      );
      this.logger.info(
        `New Erc721 Instances:\n ${JSON.stringify(erc721Instances)}`
      );
      await Erc721Contract.query()
        .insert(erc721Instances)
        .onConflict(['address'])
        .merge();
    }
  }

  async updateErc721(
    erc721Activities: Erc721Activity[],
    erc721Tokens: Erc721Token[],
    trx: Knex.Transaction
  ) {
    let updatedTokens: Dictionary<Erc721Token> = {};
    if (erc721Tokens.length > 0) {
      updatedTokens = _.keyBy(
        await Erc721Token.query()
          .insert(
            erc721Tokens.map((token) =>
              Erc721Token.fromJson({
                token_id: token.token_id,
                owner: token.owner,
                erc721_contract_address: token.erc721_contract_address,
                last_updated_height: token.last_updated_height,
              })
            )
          )
          .onConflict(['token_id', 'erc721_contract_address'])
          .merge()
          .transacting(trx),
        (o) => `${o.erc721_contract_address}_${o.token_id}`
      );
    }
    if (erc721Activities.length > 0) {
      erc721Activities.forEach((activity) => {
        const token =
          updatedTokens[
            `${activity.erc721_contract_address}_${activity.token_id}`
          ];
        if (token) {
          // eslint-disable-next-line no-param-reassign
          activity.erc721_token_id = token.id;
        }
      });
      await knex
        .batchInsert(
          'erc721_activity',
          erc721Activities.map((e) => _.omit(e, 'token_id')),
          config.erc721.chunkSizeInsert
        )
        .transacting(trx);
    }
  }

  async getTokensUri(
    tokens: Erc721Token[]
  ): Promise<Erc721MediaHandler.ITokenMediaInfo[]> {
    const contracts = tokens.map((token) =>
      getContract({
        address: token.erc721_contract_address as `0x${string}`,
        abi: Erc721Contract.ABI,
        client: this.viemClient,
      })
    );
    const batchReqs: any[] = [];
    contracts.forEach((e, index) => {
      batchReqs.push(
        e.read
          .tokenURI([BigInt(tokens[index].token_id)])
          .catch(() => Promise.resolve(undefined))
      );
    });
    const results = await Promise.all(batchReqs);
    return tokens.map((token, index) => ({
      address: token.erc721_contract_address,
      token_id: token.token_id,
      erc721_token_id: token.id,
      onchain: {
        token_uri: results[index],
        metadata: {},
      },
      offchain: {
        image: {
          url: undefined,
          content_type: undefined,
          file_path: undefined,
        },
        animation: {
          url: undefined,
          content_type: undefined,
          file_path: undefined,
        },
      },
    }));
  }

  async calErc721Stats(): Promise<Erc721Contract[]> {
    // Get once block height 24h ago.
    const blockSince24hAgo = await Block.query()
      .select('height')
      .where('time', '<=', knex.raw("now() - '24 hours'::interval"))
      .orderBy('height', 'desc')
      .limit(1);

    // Calculate total activity and transfer_24h of erc721
    return Erc721Contract.query()
      .count('erc721_activity.id AS total_activity')
      .select(
        knex.raw(
          `SUM( CASE WHEN erc721_activity.height >= ? AND erc721_activity.action IN ('${ERC721_ACTION.TRANSFER}') THEN 1 ELSE 0 END ) AS transfer_24h`,
          blockSince24hAgo[0]?.height
        )
      )
      .select('erc721_contract.id as erc721_contract_id')
      .where('erc721_contract.track', '=', true)
      .joinRelated('erc721_activity')
      .groupBy('erc721_contract.id');
  }

  async handleMissingErc721Contract(events: EvmEvent[], trx: Knex.Transaction) {
    try {
      const eventsUniqByAddress = _.keyBy(events, (e) => e.address);
      const addresses = Object.keys(eventsUniqByAddress);
      const erc721ContractsByAddress = _.keyBy(
        await Erc721Contract.query()
          .whereIn('address', addresses)
          .transacting(trx),
        (e) => e.address
      );
      const missingErc721ContractsAddress: string[] = addresses.filter(
        (addr) => !erc721ContractsByAddress[addr]
      );
      if (missingErc721ContractsAddress.length > 0) {
        const erc721ContractsInfo = await this.getBatchErc721Info(
          missingErc721ContractsAddress as `0x${string}`[]
        );
        await knex
          .batchInsert(
            'erc721_contract',
            missingErc721ContractsAddress.map((addr, index) =>
              Erc721Contract.fromJson({
                evm_smart_contract_id:
                  eventsUniqByAddress[addr].evm_smart_contract_id,
                address: addr,
                symbol: erc721ContractsInfo[index].symbol,
                name: erc721ContractsInfo[index].name,
                track: false,
                last_updated_height: -1,
              })
            ),
            config.erc721.chunkSizeInsert
          )
          .transacting(trx);
      }
    } catch (error) {
      this.logger.error('Failed to handle missing ERC721 contracts', error);
      throw error;
    }
  }

  async getErc721Instances(evmSmartContracts: EVMSmartContract[]) {
    const addresses = evmSmartContracts.map((e) => e.address);
    const erc721ContractsInfo = await this.getBatchErc721Info(
      addresses as `0x${string}`[]
    );
    return evmSmartContracts.map((e, index) =>
      Erc721Contract.fromJson({
        evm_smart_contract_id: evmSmartContracts[index].id,
        address: e.address,
        symbol: erc721ContractsInfo[index].symbol,
        name: erc721ContractsInfo[index].name,
        track: true,
        last_updated_height: e.created_height,
      })
    );
  }

  async getBatchErc721Info(addresses: `0x${string}`[]) {
    const contracts = addresses.map((address) =>
      getContract({
        address,
        abi: Erc721Contract.ABI,
        client: this.viemClient,
      })
    );
    const batchReqs: any[] = [];
    contracts.forEach((e) => {
      batchReqs.push(
        e.read.name().catch(() => Promise.resolve(undefined)),
        e.read.symbol().catch(() => Promise.resolve(undefined))
      );
    });
    const results = await Promise.all(batchReqs);
    return addresses.map((address, index) => ({
      address,
      name: results[2 * index],
      symbol: results[2 * index + 1],
    }));
  }

  public async _start(): Promise<void> {
    this.viemClient = EtherJsClient.getViemClient();
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
        BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.erc721.millisecondRepeatJob,
          },
        }
      );
      await this.createJob(
        BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
        BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.erc721.millisecondRepeatJob,
          },
        }
      );
      await this.createJob(
        BULL_JOB_NAME.HANDLE_ERC721_MEDIA,
        BULL_JOB_NAME.HANDLE_ERC721_MEDIA,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.erc721.millisecondRepeatJob,
          },
        }
      );
      await this.createJob(
        BULL_JOB_NAME.REFRESH_ERC721_STATS,
        BULL_JOB_NAME.REFRESH_ERC721_STATS,
        {},
        {
          removeOnComplete: { count: 1 },
          removeOnFail: {
            count: 3,
          },
          repeat: {
            pattern: config.erc721.timeRefreshErc721Stats,
          },
        }
      );
    }
    return super._start();
  }
}

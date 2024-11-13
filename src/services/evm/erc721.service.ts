import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import _ from 'lodash';
import { Context, ServiceBroker } from 'moleculer';
import { PublicClient, getContract } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import knex from '../../common/utils/db_connection';
import { getViemClient } from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMSmartContract,
  Erc721Activity,
  Erc721HolderStatistic,
  Erc721Stats,
  Erc721Token,
} from '../../models';
import { Erc721Contract } from '../../models/erc721_contract';
import { BULL_JOB_NAME, SERVICE } from './constant';
import { Erc721Handler } from './erc721_handler';
import { Erc721MediaHandler, ITokenMediaInfo } from './erc721_media_handler';
import { Erc721Reindexer } from './erc721_reindex';

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
      this.logger.info(
        `Handle erc721 contract from block ${startBlock} to ${endBlock}`
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
      this.logger.info(
        `Handle erc721 activity from block ${startBlock} to ${endBlock}`
      );
      const erc721Activities: Erc721Activity[] =
        await Erc721Handler.getErc721Activities(
          startBlock,
          endBlock,
          this.logger,
          undefined,
          trx
        );
      await this.handleMissingErc721Contract(erc721Activities, trx);
      if (erc721Activities.length > 0) {
        // create chunk array
        const listChunkErc721Activities = [];
        const erc721Contracts = _.keyBy(
          await Erc721Contract.query()
            .whereIn(
              'address',
              erc721Activities.map((e) => e.erc721_contract_address)
            )
            .transacting(trx),
          'address'
        );
        for (
          let i = 0;
          i < erc721Activities.length;
          i += config.erc721.chunkSizeQuery
        ) {
          const chunk = erc721Activities.slice(
            i,
            i + config.erc721.chunkSizeQuery
          );
          listChunkErc721Activities.push(chunk);
        }
        // process chunk array
        const erc721TokensOnDB: Erc721Token[] = (
          await Promise.all(
            listChunkErc721Activities.map(async (chunk) =>
              Erc721Token.query().whereIn(
                ['erc721_contract_address', 'token_id'],
                chunk.map((e) => [
                  e.erc721_contract_address,
                  // if token_id undefined (case approval_all), replace by null => not get any token (because token must have token_id)
                  e.token_id || null,
                ])
              )
            )
          )
        ).flat();
        // process chunk array
        const erc721HolderStatsOnDB: Erc721HolderStatistic[] = (
          await Promise.all(
            listChunkErc721Activities.map(async (chunk) =>
              Erc721HolderStatistic.query().whereIn(
                ['erc721_contract_address', 'owner'],
                _.uniqWith(
                  [
                    ...chunk.map((e) => [e.erc721_contract_address, e.from]),
                    ...chunk.map((e) => [e.erc721_contract_address, e.to]),
                  ],
                  _.isEqual
                )
              )
            )
          )
        ).flat();
        const erc721Tokens = _.keyBy(
          erc721TokensOnDB,
          (o) => `${o.erc721_contract_address}_${o.token_id}`
        );
        const erc721HolderStats = _.keyBy(
          erc721HolderStatsOnDB,
          (o) => `${o.erc721_contract_address}_${o.owner}`
        );
        const erc721Handler = new Erc721Handler(
          erc721Contracts,
          erc721Tokens,
          erc721Activities,
          erc721HolderStats
        );
        erc721Handler.process();
        await Erc721Handler.updateErc721(
          Object.values(erc721Handler.erc721Contracts),
          erc721Activities,
          Object.values(erc721Handler.erc721Tokens),
          Object.values(erc721Handler.erc721HolderStats),
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
  async jobHandlerTokenMedia(_payload: { tokenMedia: ITokenMediaInfo }) {
    let { tokenMedia } = _payload;
    if (tokenMedia.onchain.token_uri) {
      try {
        // update metadata
        tokenMedia.onchain.metadata = await Erc721MediaHandler.getMetadata(
          tokenMedia.onchain.token_uri
        );
      } catch (error) {
        await Erc721Token.query()
          .where('id', tokenMedia.erc721_token_id)
          .patch({
            media_info: {
              onchain: {
                token_uri: tokenMedia.onchain.token_uri,
              },
            },
          });
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
    const erc721Stats = await Erc721Handler.calErc721Stats();
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.REINDEX_ERC721,
    jobName: BULL_JOB_NAME.REINDEX_ERC721,
  })
  async reindexErc721(_payload: { address: `0x${string}` }): Promise<void> {
    const { address } = _payload;
    this.logger.info(`Reindexing erc721 contract ${address}`);
    const erc721Reindexer = new Erc721Reindexer(this.viemClient, this.logger);
    await erc721Reindexer.reindex(address);
    this.logger.info(`Reindex erc721 contract ${address} done.`);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.INSERT_ERC721_CONTRACT,
    jobName: BULL_JOB_NAME.INSERT_ERC721_CONTRACT,
  })
  async insertNewErc721Contracts(_payload: {
    evmSmartContracts: { id: number; address: string }[];
  }) {
    const evmSmartContracts = [
      ...new Map(
        _payload.evmSmartContracts.map((item) => [item.address, item])
      ).values(),
    ];
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

  @Action({
    name: SERVICE.V1.Erc721.reindexing.key,
    params: {
      addresses: {
        type: 'array',
        items: 'string',
        optional: false,
      },
    },
  })
  public async reindexing(
    ctx: Context<{
      addresses: `0x${string}`[];
    }>
  ) {
    let { addresses } = ctx.params;
    const erc721Reindexer = new Erc721Reindexer(this.viemClient, this.logger);
    addresses = await erc721Reindexer.filterReindex(addresses);
    if (addresses.length > 0) {
      this.logger.info(`Reindex erc721 contracts: ${addresses}`);
      await Promise.all(
        addresses.map((address) =>
          this.createJob(
            BULL_JOB_NAME.REINDEX_ERC721,
            BULL_JOB_NAME.REINDEX_ERC721,
            {
              address,
            },
            {
              jobId: address,
              removeOnComplete: true,
            }
          )
        )
      );
    } else {
      this.logger.info('No erc721 contracts satisfied');
    }
  }

  async getTokensUri(tokens: Erc721Token[]): Promise<ITokenMediaInfo[]> {
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

  async handleMissingErc721Contract(
    erc721Activities: Erc721Activity[],
    trx: Knex.Transaction
  ) {
    try {
      const eventsUniqByAddress = _.keyBy(
        erc721Activities,
        (e) => e.erc721_contract_address
      );
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
    this.viemClient = getViemClient();
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

import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import knex from 'src/common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  IContextCrawlMissingContractHistory,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import {
  BlockCheckpoint,
  MissingContractCheckpoint,
  SmartContract,
} from '../../models';
import CW721Contract from '../../models/cw721_contract';
import CW721Token from '../../models/cw721_token';

const { NODE_ENV } = Config;

export interface IAddressParam {
  address: string;
}

@Service({
  name: SERVICE.V1.CW721CrawlMissingContract.key,
  version: 1,
})
export default class Cw721MissingContractService extends BullableService {
  _httpBatchClient!: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_HISTORY_MISSING_CONTRACT,
    jobName: BULL_JOB_NAME.HANDLE_HISTORY_MISSING_CONTRACT,
  })
  async jobHandler(): Promise<void> {
    const missingContractsCheckpoint =
      await MissingContractCheckpoint.query().where(
        'checkpoint',
        '<',
        'end_block'
      );
    // eslint-disable-next-line no-restricted-syntax
    for (const missingContractCheckpoint of missingContractsCheckpoint) {
      // eslint-disable-next-line no-await-in-loop
      await this.createJob(
        BULL_JOB_NAME.FILL_HISTORY_BY_MISSING_CONTRACT,
        BULL_JOB_NAME.FILL_HISTORY_BY_MISSING_CONTRACT,
        {
          smartContractId: missingContractCheckpoint.smart_contract_id,
        },
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 1,
          },
        }
      );
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.FILL_HISTORY_BY_MISSING_CONTRACT,
    jobName: BULL_JOB_NAME.FILL_HISTORY_BY_MISSING_CONTRACT,
  })
  async jobHandlerFillHistory(_payload: {
    smartContractId: number;
  }): Promise<void> {
    const { smartContractId } = _payload;
    const missingContractCheckpoint = await MissingContractCheckpoint.query()
      .where('smart_contract_id', smartContractId)
      .first()
      .throwIfNotFound();
    const startBlock = missingContractCheckpoint.checkpoint;
    const endBlock = Math.min(
      startBlock + config.cw721.crawlMissingContract.blocksPerCall
    );
    await this.broker.call(SERVICE.V1.Cw721.CrawlMissingContractHistory.path, {
      smartContractId,
      startBlock,
      endBlock,
    } satisfies IContextCrawlMissingContractHistory);
  }

  @Action({
    name: SERVICE.V1.CW721CrawlMissingContract.CrawlMissingContract.key,
    params: {
      contractAddress: 'string',
    },
  })
  private async CrawlMissingContract(ctx: Context<IAddressParam>) {
    await knex.transaction(async (trx) => {
      const smartContract = await SmartContract.query()
        .transacting(trx)
        .withGraphJoined('code')
        .where('address', ctx.params.address)
        .first()
        .throwIfNotFound();
      const cw721Contract = await CW721Contract.query()
        .transacting(trx)
        .withGraphJoined('smart_contract')
        .where('smart_contract.address', ctx.params.address)
        .first();
      // check whether contract is CW721 type -> throw error to user
      if (smartContract.code.type === 'CW721') {
        // if contract have been in cw721_contract DB -> skip
        if (!cw721Contract) {
          // query
          const contractInfo = (
            await CW721Contract.getContractsInfo(
              [ctx.params.address],
              this._httpBatchClient,
              this.logger
            )
          )[0];
          const momentTokensOwner = await CW721Contract.getTokensOwner(
            ctx.params.address,
            this._httpBatchClient
          );
          const minUpdatedHeightOwner = Math.min(
            ...momentTokensOwner.map(
              (tokenOwner) => tokenOwner.last_updated_height
            )
          );
          const result = await Promise.all([
            CW721Contract.query()
              .transacting(trx)
              .insertGraph({
                ...CW721Contract.fromJson({
                  contract_id: smartContract.id,
                  symbol: contractInfo?.symbol,
                  minter: contractInfo?.minter,
                  name: contractInfo?.name,
                  track: true,
                }),
                tokens: momentTokensOwner.map((tokenOwner) =>
                  CW721Token.fromJson({
                    token_id: tokenOwner.token_id,
                    media_info: null,
                    owner: tokenOwner.owner,
                    last_updated_height: tokenOwner.last_updated_height,
                    burned: false,
                  })
                ),
              })
              .transacting(trx),
            BlockCheckpoint.query()
              .where('job_name', BULL_JOB_NAME.HANDLE_CW721_TRANSACTION)
              .first()
              .throwIfNotFound(),
          ]);
          const blockHeight = result[1].height;
          await MissingContractCheckpoint.query()
            .transacting(trx)
            .insert(
              MissingContractCheckpoint.fromJson({
                smart_contract_id: smartContract.id,
                checkpoint: config.crawlBlock.startBlock,
                end_block: minUpdatedHeightOwner,
              })
            );
          // handle from minUpdatedHeightOwner to blockHeight
          await this.broker.call(
            SERVICE.V1.Cw721.HandleRangeBlockMissingContract.path,
            {
              smartContractId: smartContract.id,
              startBlock: minUpdatedHeightOwner,
              endBlock: blockHeight,
            } satisfies IContextCrawlMissingContractHistory
          );
        }
      } else {
        throw new Error(
          `Smart contract ${ctx.params.address} is not CW721 type`
        );
      }
    });
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.HANDLE_HISTORY_MISSING_CONTRACT,
        BULL_JOB_NAME.HANDLE_HISTORY_MISSING_CONTRACT,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.cw721.crawlMissingContract.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }
}

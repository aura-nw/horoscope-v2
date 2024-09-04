import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { PublicClient } from 'viem';
import { getViemClient } from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMBlock,
  EvmInternalTransaction,
  EVMTransaction,
} from '../../models';
import { BULL_JOB_NAME, SERVICE } from './constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.EVMCrawlInternalTx.key,
  version: 1,
})
export default class EvmCrawlInternalTxService extends BullableService {
  viemJsClient!: PublicClient;

  // private selectedChain: any = networks.find(
  //   (network) => network.chainId === config.chainId
  // );

  // private EvmJsonRpc = this.selectedChain.EVMJSONRPC[0];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.EVM_CRAWL_INTERNAL_TX,
    jobName: BULL_JOB_NAME.EVM_CRAWL_INTERNAL_TX,
    concurrency: 1,
  })
  async jobHandler() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.EVM_CRAWL_INTERNAL_TX,
        [
          config.evmOnly
            ? BULL_JOB_NAME.CRAWL_EVM_TRANSACTION
            : BULL_JOB_NAME.HANDLE_TRANSACTION_EVM,
        ],
        config.evmCrawlInternalTx.key
      );
    this.logger.info(
      `Crawl internal transaction from block ${startBlock} to block ${endBlock}`
    );

    if (startBlock >= endBlock) {
      return;
    }
    const [evmBlocks, evmTxs] = await Promise.all([
      EVMBlock.query()
        .where('height', '>', startBlock)
        .andWhere('height', '<=', endBlock),
      EVMTransaction.query()
        .select('id', 'hash')
        .where('height', '>', startBlock)
        .andWhere('height', '<=', endBlock),
    ]);

    if (evmBlocks.length === 0) {
      this.logger.info(`No evm block found from ${startBlock} to ${endBlock}`);
      blockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(blockCheckpoint)
        .onConflict('job_name')
        .merge();
      return;
    }

    const requests = evmBlocks.map((evmBlock) =>
      this.viemJsClient.request<any>({
        method: 'debug_traceBlockByNumber',
        params: [
          `0x${evmBlock.height.toString(16)}`,
          {
            tracer: 'callTracer',
          },
        ],
      })
    );

    // const requests = evmBlocks.map((evmBlock) =>
    //   axios({
    //     url: 'https://testnet.storyrpc.io',
    //     method: 'POST',
    //     headers: {
    //       Accept: 'application/json',
    //       'Content-Type': 'application/json',
    //     },
    //     data: {
    //       jsonrpc: '2.0',
    //       id: evmBlock.height,
    //       method: 'debug_traceBlockByNumber',
    //       params: [
    //         `0x${evmBlock.height.toString(16)}`,
    //         {
    //           tracer: 'callTracer',
    //           timeout: config.evmCrawlInternalTx.timeoutJSONRPC,
    //         },
    //       ],
    //     },
    //   })
    // );
    const responseBlocks = await Promise.all(requests);
    const internalTxSave: EvmInternalTransaction[] = [];

    responseBlocks.forEach((responseBlock: any) => {
      if (responseBlock) {
        responseBlock.forEach((responseTx: any) => {
          if (responseTx.result?.calls) {
            const { txHash } = responseTx;
            const evmTxDB = evmTxs.find((tx) => tx.hash === txHash);
            if (!evmTxDB) {
              throw Error('Cannot found this evm_tx_id');
            }
            const resultTx = responseTx.result;
            const internalTx = this.buildEvmInternalTransaction(
              resultTx,
              evmTxDB.id
            );
            internalTxSave.push(...internalTx);
          }
        });
      }
    });

    await knex.transaction(async (trx) => {
      blockCheckpoint.height = endBlock;
      if (internalTxSave.length > 0) {
        await knex
          .batchInsert(
            EvmInternalTransaction.tableName,
            internalTxSave,
            config.evmCrawlInternalTx.chunkSize
          )
          .transacting(trx);
      }

      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(blockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
  }

  public buildEvmInternalTransaction(
    tracerResult: any,
    tracerId: number
  ): EvmInternalTransaction[] {
    const internalTxSave: EvmInternalTransaction[] = [];
    const buildEvmInternalTx = (
      calls: any[],
      currentTypeTraceAddress: string | null,
      parentType: string
    ) => {
      calls.forEach((call, stackTraceIndex) => {
        const typeTraceAddress = currentTypeTraceAddress
          ? `${currentTypeTraceAddress}_${parentType}[${stackTraceIndex}]`
          : `${parentType}[${stackTraceIndex}]`;
        internalTxSave.push(
          EvmInternalTransaction.fromJson({
            evm_tx_id: tracerId,
            type_trace_address: `${typeTraceAddress}_${call.type}`,
            type: call.type,
            from: call.from,
            to: call.to,
            value: parseInt(call.value ?? 0, 16),
            input: call.input,
            gas: parseInt(call.gas, 16),
            gas_used: parseInt(call.gasUsed, 16),
            error: call.error,
          })
        );
        if (call.calls) {
          buildEvmInternalTx(call.calls, typeTraceAddress, call.type);
        }
      });
    };

    buildEvmInternalTx(tracerResult.calls, null, tracerResult.type);
    return internalTxSave;
  }

  public async _start(): Promise<void> {
    this.viemJsClient = getViemClient();
    await this.createJob(
      BULL_JOB_NAME.EVM_CRAWL_INTERNAL_TX,
      BULL_JOB_NAME.EVM_CRAWL_INTERNAL_TX,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.evmCrawlInternalTx.millisecondCrawl,
        },
      }
    );
    await super._start();
  }
}

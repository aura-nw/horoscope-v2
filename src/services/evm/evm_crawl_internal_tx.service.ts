import axios from 'axios';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  BlockCheckpoint,
  EvmInternalTransaction,
  EVMTransaction,
} from '../../models';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import networks from '../../../network.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.EVMCrawlInternalTx.key,
  version: 1,
})
export default class EvmCrawlInternalTxService extends BullableService {
  private selectedChain: any = networks.find(
    (network) => network.chainId === config.chainId
  );

  private EvmJsonRpc = this.selectedChain.EVMJSONRPC[0];

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
        [BULL_JOB_NAME.HANDLE_TRANSACTION_EVM],
        config.evmCrawlInternalTx.key
      );
    this.logger.info(
      `Crawl internal transaction from block ${startBlock} to block ${endBlock}`
    );

    if (startBlock >= endBlock) {
      return;
    }

    const evmTxs = await EVMTransaction.query()
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock);

    if (evmTxs.length === 0) {
      this.logger.info(
        `No evm transaction found from ${startBlock} to ${endBlock}`
      );
      return;
    }

    const requests = evmTxs.map((evmTx) =>
      axios({
        url: this.EvmJsonRpc,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data: {
          id: evmTx.id,
          method: 'debug_traceTransaction',
          params: [evmTx.hash, { tracer: 'callTracer' }],
        },
      })
    );

    const response = await Promise.all(requests).then((res) =>
      res.map((result) => result.data)
    );
    const internalTxSave: EvmInternalTransaction[] = [];

    response.forEach((tracer) => {
      if (tracer.result?.calls) {
        const internalTx = this.buildEvmInternalTransaction(
          tracer.result,
          tracer.id
        );
        internalTxSave.push(...internalTx);
      }
    });

    await knex.transaction(async (trx) => {
      blockCheckpoint.height = endBlock;
      await trx
        .batchInsert(
          EvmInternalTransaction.tableName,
          internalTxSave,
          config.evmCrawlInternalTx.chunkSize
        )
        .transacting(trx);
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

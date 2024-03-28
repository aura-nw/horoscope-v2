import axios from 'axios';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import pkg from '@ethereum-sourcify/lib-sourcify';
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
  private _sourcifyChain!: pkg.SourcifyChain;

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
        url: this._sourcifyChain.rpc[0].toString(),
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
        this.buildEvmInternalTransaction(
          internalTxSave,
          tracer.result.calls,
          tracer.id
        );
      }
    });

    await knex.transaction(async (trx) => {
      blockCheckpoint.height = endBlock;
      await EvmInternalTransaction.query().insert(internalTxSave);
      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(blockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
  }

  public buildEvmInternalTransaction(
    internalTxSave: EvmInternalTransaction[],
    calls: any[],
    tracerId: number,
    currentTypeTraceAddress: null | string = null
  ) {
    let stackTraceIndex = 0;
    calls.forEach((call) => {
      const typeTraceAddress = currentTypeTraceAddress
        ? `${currentTypeTraceAddress}_${stackTraceIndex}`
        : `${call.type}_${stackTraceIndex}`;
      internalTxSave.push(
        EvmInternalTransaction.fromJson({
          evm_tx_id: tracerId,
          type_trace_address: typeTraceAddress,
          type: call.type,
          from: call.from,
          to: call.to,
          value: parseInt(call.value, 16),
          input: call.input,
          gas: parseInt(call.gas, 16),
          gas_used: parseInt(call.gasUsed, 16),
        })
      );
      if (call.calls) {
        this.buildEvmInternalTransaction(
          internalTxSave,
          call.calls,
          tracerId,
          typeTraceAddress
        );
      }
      stackTraceIndex += 1;
    });
  }

  public async _start(): Promise<void> {
    const selectedChain = networks.find(
      (network) => network.chainId === config.chainId
    );
    if (
      !selectedChain ||
      !selectedChain.EVMchainId ||
      !selectedChain.EVMJSONRPC
    ) {
      this.logger.error(
        'Cannot found chain EVM with chainId: ',
        config.chainId
      );
      return;
    }
    this._sourcifyChain = new pkg.SourcifyChain({
      chainId: selectedChain.EVMchainId,
      name: config.chainName,
      rpc: selectedChain.EVMJSONRPC,
      supported: true,
    });

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

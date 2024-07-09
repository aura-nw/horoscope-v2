import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { PublicClient, decodeAbiParameters } from 'viem';
import _ from 'lodash';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import config from '../../../../config.json' assert { type: 'json' };
import '../../../../fetch-polyfill.js';
import { BlockCheckpoint, OptimismWithdrawal, EvmEvent } from '../../../models';
import knex from '../../../common/utils/db_connection';
import { getViemClient } from '../../../common/utils/etherjs_client';

@Service({
  name: SERVICE.V1.HandleOptimismWithdrawalEVM.key,
  version: 1,
})
export default class HandleOptimismWithdrawalEVMService extends BullableService {
  viemClient!: PublicClient;

  ABI_MESSAGE_PASSED = [
    {
      name: 'nonce',
      type: 'uint256',
    },
    {
      name: 'sender',
      type: 'address',
    },
    {
      name: 'target',
      type: 'address',
    },
  ];

  // 32-byte signature of the event MessagePassed(uint256 indexed nonce, address indexed sender, address indexed target, uint256 value, uint256 gasLimit, bytes data, bytes32 withdrawalHash)
  MESSAGE_PASSED_EVENT =
    '0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054';

  // 32-byte signature of the event WithdrawalProven(bytes32 indexed withdrawalHash, address indexed from, address indexed to)
  WITHDRAWAL_PROVEN_EVENT =
    '0x67a6208cfcc0801d50f6cbe764733f4fddf66ac0b04442061a8a8c0cb6b63f62';

  // 32-byte signature of the Blast chain event WithdrawalProven(bytes32 indexed withdrawalHash, address indexed from, address indexed to, uint256 requestId)
  WITHDRAWAL_PROVEN_EVENT_BLAST =
    '0x5d5446905f1f582d57d04ced5b1bed0f1a6847bcee57f7dd9d6f2ec12ab9ec2e';

  // 32-byte signature of the event WithdrawalFinalized(bytes32 indexed withdrawalHash, bool success)
  WITHDRAWAL_FINALIZED_EVENT =
    '0xdb5c7652857aa163daadd670e116628fb42e869d8ac4251ef8971d9e5727df1b';

  // 32-byte signature of the Blast chain event WithdrawalFinalized(bytes32 indexed withdrawalHash, uint256 indexed hintId, bool success)
  WITHDRAWAL_FINALIZED_EVENT_BLAST =
    '0x36d89e6190aa646d1a48286f8ad05e60a144483f42fd7e0ea08baba79343645b';

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_OPTIMISM_WITHDRAWAL,
    jobName: BULL_JOB_NAME.HANDLE_OPTIMISM_WITHDRAWAL,
  })
  async handleOptimismWithdrawal() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_OPTIMISM_WITHDRAWAL,
        [BULL_JOB_NAME.CRAWL_EVM_TRANSACTION],
        config.handleOptimismWithdrawal.key
      );
    this.logger.info(
      `Handle optimism withdrawal from block ${startBlock} to ${endBlock}`
    );
    if (startBlock >= endBlock) {
      return;
    }
    const evmEvents = await EvmEvent.query()
      .where('block_height', '>', startBlock)
      .andWhere('block_height', '<=', endBlock)
      .andWhere('address', config.handleOptimismWithdrawal.messageParser)
      .andWhere('topic0', this.MESSAGE_PASSED_EVENT)
      .withGraphFetched('evm_transaction');
    await knex.transaction(async (trx) => {
      if (evmEvents.length > 0) {
        const optimismWithdrawals: any[] = [];
        evmEvents.forEach((evmEvent) => {
          const [nonce, ,] = decodeAbiParameters(
            this.ABI_MESSAGE_PASSED,
            (evmEvent.topic1 +
              evmEvent.topic2.slice(2) +
              evmEvent.topic3.slice(2)) as `0x${string}`
          );
          optimismWithdrawals.push({
            l2_tx_hash: evmEvent.evm_transaction.hash,
            l2_block: evmEvent.evm_transaction.height,
            sender: evmEvent.evm_transaction.from,
            timestamp: evmEvent.evm_transaction.timestamp,
            msg_nonce: nonce,
          });
        });
        if (evmEvents.length > 0) {
          await trx.batchInsert(
            OptimismWithdrawal.tableName,
            optimismWithdrawals,
            config.handleOptimismWithdrawal.chunkSize
          );
        }
      }
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;
        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .transacting(trx);
      }
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_OPTIMISM_WITHDRAWAL_EVENT_ON_L1,
    jobName: BULL_JOB_NAME.CRAWL_OPTIMISM_WITHDRAWAL_EVENT_ON_L1,
  })
  async crawlOptimismWithdrawalEventOnL1() {
    let blockCheckpoint = await BlockCheckpoint.query().findOne(
      'job_name',
      BULL_JOB_NAME.CRAWL_OPTIMISM_WITHDRAWAL_EVENT_ON_L1
    );
    if (!blockCheckpoint) {
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.CRAWL_OPTIMISM_WITHDRAWAL_EVENT_ON_L1,
        height: config.crawlOptimismWithdrawalEventOnL1.startBlockInL1,
      });
    }
    const latestBlockL1 = await this.viemClient.getBlockNumber();
    const startBlock = blockCheckpoint.height + 1;
    const endBlock = Math.min(
      startBlock + config.crawlOptimismWithdrawalEventOnL1.blocksPerCall - 1,
      parseInt(latestBlockL1.toString(), 10)
    );
    if (startBlock > endBlock) {
      return;
    }
    this.logger.info(
      `Crawl Optimism Withdrawal Event from block ${startBlock} to block ${endBlock}`
    );
    const events = await this.viemClient.getLogs({
      fromBlock: BigInt(startBlock),
      toBlock: BigInt(endBlock),
      address: config.crawlOptimismWithdrawalEventOnL1
        .l1OptimismPortal as `0x${string}`,
      events: [
        this.WITHDRAWAL_FINALIZED_EVENT,
        this.WITHDRAWAL_FINALIZED_EVENT_BLAST,
        this.WITHDRAWAL_PROVEN_EVENT,
        this.WITHDRAWAL_PROVEN_EVENT_BLAST,
      ],
    });
    const txPromises = events.map((event) =>
      this.viemClient.getTransactionReceipt({
        hash: event.transactionHash,
      })
    );
    const blockPromises = events.map((event) =>
      this.viemClient.getBlock({
        blockNumber: event.blockNumber,
        includeTransactions: false,
      })
    );
    const [blocks, txs] = await Promise.all([
      Promise.all(blockPromises),
      Promise.all(txPromises),
    ]);
    const blockByHeight = _.keyBy(blocks, 'number');
    await knex.transaction(async (trx) => {
      this.logger.debug(txs);
      this.logger.debug(blockByHeight);
      blockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(blockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  async _start(): Promise<void> {
    this.viemClient = getViemClient(
      config.crawlOptimismWithdrawalEventOnL1.l1ChainId
    );
    this.createJob(
      BULL_JOB_NAME.HANDLE_OPTIMISM_WITHDRAWAL,
      BULL_JOB_NAME.HANDLE_OPTIMISM_WITHDRAWAL,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleOptimismWithdrawal.millisecondCrawl,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.CRAWL_OPTIMISM_WITHDRAWAL_EVENT_ON_L1,
      BULL_JOB_NAME.CRAWL_OPTIMISM_WITHDRAWAL_EVENT_ON_L1,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlOptimismWithdrawalEventOnL1.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

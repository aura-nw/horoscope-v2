import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import {
  PublicClient,
  decodeAbiParameters,
  toHex,
  defineChain,
  Chain,
} from 'viem';
import _ from 'lodash';
import axios from 'axios';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import config from '../../../../config.json' assert { type: 'json' };
import networks from '../../../../network.json' assert { type: 'json' };
import '../../../../fetch-polyfill.js';
import { BlockCheckpoint, OptimismWithdrawal, EvmEvent } from '../../../models';
import knex from '../../../common/utils/db_connection';
import { getViemClient } from '../../../common/utils/etherjs_client';

@Service({
  name: SERVICE.V1.HandleOptimismWithdrawalEVM.key,
  version: 1,
})
export default class HandleOptimismWithdrawalEVMService extends BullableService {
  viemClientL1!: PublicClient;

  l2Chain!: Chain;

  ABI_MESSAGE_PASSED_INDEXED = [
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

  ABI_MESSAGE_PASSED_NON_INDEXED = [
    {
      name: 'value',
      type: 'uint256',
    },
    {
      name: 'gasLimit',
      type: 'uint256',
    },
    {
      name: 'data',
      type: 'bytes',
    },
    {
      name: 'withdrawalHash',
      type: 'bytes32',
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
    // scan evm event fromBlock to toBlock to get event with (address, topic0) for MESSAGE_PASSED_EVENT
    const evmEvents = await EvmEvent.query()
      .where('block_height', '>', startBlock)
      .andWhere('block_height', '<=', endBlock)
      .andWhere('address', config.handleOptimismWithdrawal.messageParser)
      .andWhere('topic0', this.MESSAGE_PASSED_EVENT)
      .withGraphFetched('evm_transaction');

    await Promise.all(
      evmEvents.map(async (evmEvent) => {
        const txReceipt = this.rebuildTxFromEvmEvent(evmEvent);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const status = await this.viemClientL1.getWithdrawalStatus({
          receipt: txReceipt,
          portalAddress:
            config.crawlOptimismWithdrawalEventOnL1.l1OptimismPortal,
          targetChain: this.l2Chain,
          l2OutputOracleAddress:
            config.crawlOptimismWithdrawalEventOnL1.l2OutputOracleProxy,
        });
        // eslint-disable-next-line no-param-reassign
        evmEvent.withdrawalStatus = status;
      })
    );
    const optimismWithdrawals: OptimismWithdrawal[] = [];
    if (evmEvents.length > 0) {
      evmEvents.forEach(async (evmEvent) => {
        const [nonce, ,] = decodeAbiParameters(
          this.ABI_MESSAGE_PASSED_INDEXED,
          (evmEvent.topic1 +
            evmEvent.topic2.slice(2) +
            evmEvent.topic3.slice(2)) as `0x${string}`
        );
        const [, , , withdrawalHash] = decodeAbiParameters(
          this.ABI_MESSAGE_PASSED_NON_INDEXED,
          `0x${evmEvent.data.toString('hex')}`
        );
        optimismWithdrawals.push(
          OptimismWithdrawal.fromJson({
            l2_tx_hash: evmEvent.evm_transaction.hash,
            l2_block: evmEvent.evm_transaction.height,
            sender: evmEvent.evm_transaction.from,
            timestamp: evmEvent.evm_transaction.timestamp,
            msg_nonce: nonce,
            withdrawal_hash: withdrawalHash,
            status: evmEvent.withdrawalStatus,
            evm_event_id: evmEvent.id,
            evm_tx_id: evmEvent.evm_tx_id,
          })
        );
      });
    }
    await knex.transaction(async (trx) => {
      if (optimismWithdrawals.length > 0) {
        await trx.batchInsert(
          OptimismWithdrawal.tableName,
          optimismWithdrawals,
          config.handleOptimismWithdrawal.chunkSize
        );
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
    const latestBlockL1 = await this.viemClientL1.getBlockNumber();
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

    const l1Chain = networks.find(
      (network) =>
        network.chainId === config.crawlOptimismWithdrawalEventOnL1.l1ChainId
    );
    if (!l1Chain || !l1Chain.EVMJSONRPC) {
      throw new Error(`EVMJSONRPC not found with chainId: ${config.chainId}`);
    }

    // scan l1 layer has 1 of 4 event (WITHDRAWAL_PROVEN_EVENT/WITHDRAWAL_PROVEN_EVENT_BLAST/WITHDRAWAL_FINALIZED_EVENT/WITHDRAWAL_FINALIZED_EVENT_BLAST) fromBlock to toBlock
    const events = (
      await axios({
        url: l1Chain.EVMJSONRPC[0],
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data: {
          jsonrpc: '2.0',
          id: '1',
          method: 'eth_getLogs',
          params: [
            {
              fromBlock: toHex(startBlock),
              toBlock: toHex(endBlock),
              address: config.crawlOptimismWithdrawalEventOnL1.l1OptimismPortal,
              topics: [
                [
                  this.WITHDRAWAL_PROVEN_EVENT,
                  this.WITHDRAWAL_PROVEN_EVENT_BLAST,
                  this.WITHDRAWAL_FINALIZED_EVENT,
                  this.WITHDRAWAL_FINALIZED_EVENT_BLAST,
                ],
              ],
            },
          ],
        },
      })
    ).data.result;
    const listUpdateOpWithdrawalStatus: {
      id: number;
      status: string;
      txHash: string;
    }[] = [];
    await Promise.all(
      events.map(async (event: any) => {
        const withdrawalHash = event.topics[1];
        const opWithdrawal = await OptimismWithdrawal.query()
          .findOne('withdrawal_hash', withdrawalHash)
          .withGraphFetched('evm_event');
        if (!opWithdrawal) {
          throw Error(
            `Cannot found Optimism Withdrawal with hash ${withdrawalHash}`
          );
        }
        const txReceipt = this.rebuildTxFromEvmEvent(opWithdrawal.evm_event);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const status = await this.viemClientL1.getWithdrawalStatus({
          receipt: txReceipt,
          portalAddress:
            config.crawlOptimismWithdrawalEventOnL1.l1OptimismPortal,
          targetChain: this.l2Chain,
          l2OutputOracleAddress:
            config.crawlOptimismWithdrawalEventOnL1.l2OutputOracleProxy,
        });

        listUpdateOpWithdrawalStatus.push({
          id: opWithdrawal.id,
          status,
          txHash:
            status === OptimismWithdrawal.STATUS.FINALIZE
              ? event.transactionHash
              : null,
        });
      })
    );

    await knex.transaction(async (trx) => {
      if (listUpdateOpWithdrawalStatus.length > 0) {
        const stringListUpdates = listUpdateOpWithdrawalStatus
          .map((update) => {
            if (update.txHash) {
              return `(${update.id}, '${update.status}', '${update.txHash}')`;
            }
            return `(${update.id}, '${update.status}', NULL)`;
          })
          .join(',');
        await trx.raw(
          `UPDATE ${OptimismWithdrawal.tableName} SET status = temp.status, l1_tx_hash = temp.txHash from (VALUES ${stringListUpdates}) as temp(id, status, txHash) where temp.id = ${OptimismWithdrawal.tableName}.id`
        );
      }
      blockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(blockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  async _start(): Promise<void> {
    // create currentChain as L2 Chain
    const currentChain = networks.find(
      (network) => network.chainId === config.chainId
    );
    if (!currentChain || !currentChain.EVMJSONRPC) {
      throw new Error(`EVMJSONRPC not found with chainId: ${config.chainId}`);
    }

    this.l2Chain = defineChain({
      id: currentChain.EVMchainId,
      name: currentChain.EVMchainId.toString(),
      nativeCurrency: {
        name: '',
        symbol: '',
        decimals: 18,
      },
      contracts: {
        multicall3: {
          address: config.crawlOptimismWithdrawalEventOnL1
            .multicall3Contract as `0x${string}`,
        },
      },
      rpcUrls: {
        default: {
          http: currentChain.EVMJSONRPC,
        },
      },
    });

    this.viemClientL1 = getViemClient(
      config.crawlOptimismWithdrawalEventOnL1.l1ChainId,
      this.l2Chain
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

  rebuildTxFromEvmEvent(evmEvent: EvmEvent) {
    return {
      transactionHash: evmEvent.tx_hash,
      blockNumber: evmEvent.block_height,
      logs: [
        {
          address: evmEvent.address,
          topics: [
            evmEvent.topic0,
            evmEvent.topic1,
            evmEvent.topic2,
            evmEvent.topic3,
          ],
          data: evmEvent.data,
        },
      ],
    };
  }
}

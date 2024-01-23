/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { AfterEach, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Block, Transaction } from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';
import JobReAssignMsgIndexToEvent from '../../../../src/services/job/reassign_msg_index_to_event.service';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import AuraRegistry from '../../../../src/services/crawl-tx/aura.registry';

@Describe('Test job reassign msg index to event attribute')
export default class CrawlTransactionTest {
  broker = new ServiceBroker({ logger: false });

  reassignMsgIndexService?: JobReAssignMsgIndexToEvent;

  crawlTxService?: CrawlTxService;

  @BeforeEach()
  async initSuite() {
    this.reassignMsgIndexService = this.broker.createService(
      JobReAssignMsgIndexToEvent
    ) as JobReAssignMsgIndexToEvent;

    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;

    const auraRegistry = new AuraRegistry(this.crawlTxService.logger);
    auraRegistry.setCosmosSdkVersionByString('v0.45.7');

    this.crawlTxService.setRegistry(auraRegistry);
    await Promise.all([
      knex.raw(
        'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
      ),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
    ]);
  }

  @Test('Test generate list update msg index')
  public async testGenerateListUpdateMsgIndex() {
    const blockData = {
      ...Block.fromJson({
        height: 1,
        hash: 1,
        time: '2022-12-20T20:48:10.081247527Z',
        proposer_address: 'xxx',
        data: {},
      }),
      txs: [
        {
          '#id': 'transaction-marked',
          hash: 'xxx',
          codespace: '',
          code: 0,
          gas_used: '0',
          gas_wanted: '0',
          gas_limit: '0',
          fee: '0',
          index: 0,
          timestamp: '2022-12-20T20:48:10.081247527Z',
          data: {
            tx_response: {
              logs: [
                {
                  events: [
                    {
                      type: 'coin_received',
                      attributes: [
                        {
                          key: 'receiver',
                          value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                        },
                        {
                          key: 'amount',
                          value: '672714ueaura',
                        },
                        {
                          key: 'receiver',
                          value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw',
                        },
                        {
                          key: 'amount',
                          value: '4266152ueaura',
                        },
                      ],
                    },
                    {
                      type: 'coin_spent',
                      attributes: [
                        {
                          key: 'spender',
                          value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
                        },
                        {
                          key: 'amount',
                          value: '672714ueaura',
                        },
                        {
                          key: 'spender',
                          value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                        },
                        {
                          key: 'amount',
                          value: '4266152ueaura',
                        },
                      ],
                    },
                    {
                      type: 'delegate',
                      attributes: [
                        {
                          key: 'validator',
                          value:
                            'auravaloper1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfe2raql',
                        },
                        {
                          key: 'amount',
                          value: '4266152ueaura',
                        },
                        {
                          key: 'new_shares',
                          value: '4266152.000000000000000000',
                        },
                      ],
                    },
                    {
                      type: 'message',
                      attributes: [
                        {
                          key: 'action',
                          value: '/cosmos.staking.v1beta1.MsgDelegate',
                        },
                        {
                          key: 'sender',
                          value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
                        },
                        {
                          key: 'module',
                          value: 'staking',
                        },
                        {
                          key: 'sender',
                          value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                        },
                      ],
                    },
                    {
                      type: 'transfer',
                      attributes: [
                        {
                          key: 'recipient',
                          value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                        },
                        {
                          key: 'sender',
                          value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
                        },
                        {
                          key: 'amount',
                          value: '672714ueaura',
                        },
                      ],
                    },
                    {
                      type: 'withdraw_rewards',
                      attributes: [
                        {
                          key: 'amount',
                          value: '672714ueaura',
                        },
                        {
                          key: 'validator',
                          value:
                            'auravaloper1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfe2raql',
                        },
                      ],
                    },
                  ],
                },
              ],
              events: [
                {
                  type: 'coin_spent',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'c3BlbmRlcg==',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'MjAwdWVhdXJh',
                    },
                  ],
                },
                {
                  type: 'coin_received',
                  attributes: [
                    {
                      key: 'cmVjZWl2ZXI=',
                      index: true,
                      value:
                        'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'MjAwdWVhdXJh',
                    },
                  ],
                },
                {
                  type: 'transfer',
                  attributes: [
                    {
                      key: 'cmVjaXBpZW50',
                      index: true,
                      value:
                        'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                    },
                    {
                      key: 'c2VuZGVy',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'MjAwdWVhdXJh',
                    },
                  ],
                },
                {
                  type: 'message',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'c2VuZGVy',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                  ],
                },
                {
                  type: 'tx',
                  attributes: [
                    {
                      key: 'ZmVl',
                      index: true,
                      value: 'MjAwdWVhdXJh',
                    },
                    {
                      key: 'ZmVlX3BheWVy',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                  ],
                },
                {
                  type: 'tx',
                  attributes: [
                    {
                      key: 'YWNjX3NlcQ==',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcC8zOTkxNjg=',
                    },
                  ],
                },
                {
                  type: 'tx',
                  attributes: [
                    {
                      key: 'c2lnbmF0dXJl',
                      index: true,
                      value:
                        'aXV2UFVMUEo1dFBHdmR3V0FOR0RPOTNqYUdJNDhjeVNybVFrSnB1S0psTWFSRk9YbTd2b0FGa0NEejJvT1JYcWFIMHV1VVlSWjJCbmhFcjFsV3VlS3c9PQ==',
                    },
                  ],
                },
                {
                  type: 'message',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'YWN0aW9u',
                      index: true,
                      value: 'L2Nvc21vcy5zdGFraW5nLnYxYmV0YTEuTXNnRGVsZWdhdGU=',
                    },
                  ],
                },
                {
                  type: 'coin_spent',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'c3BlbmRlcg==',
                      index: true,
                      value:
                        'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'NjcyNzE0dWVhdXJh',
                    },
                  ],
                },
                {
                  type: 'coin_received',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'cmVjZWl2ZXI=',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'NjcyNzE0dWVhdXJh',
                    },
                  ],
                },
                {
                  type: 'transfer',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'cmVjaXBpZW50',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                    {
                      key: 'c2VuZGVy',
                      index: true,
                      value:
                        'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'NjcyNzE0dWVhdXJh',
                    },
                  ],
                },
                {
                  type: 'message',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'c2VuZGVy',
                      index: true,
                      value:
                        'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                    },
                  ],
                },
                {
                  type: 'withdraw_rewards',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'NjcyNzE0dWVhdXJh',
                    },
                    {
                      key: 'dmFsaWRhdG9y',
                      index: true,
                      value:
                        'YXVyYXZhbG9wZXIxY2pwMmphMzZ6OXRkYWEwbDM3eXBrenoydmF4aDI0bGZlMnJhcWw=',
                    },
                  ],
                },
                {
                  type: 'coin_spent',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'c3BlbmRlcg==',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'NDI2NjE1MnVlYXVyYQ==',
                    },
                  ],
                },
                {
                  type: 'coin_received',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'cmVjZWl2ZXI=',
                      index: true,
                      value:
                        'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'NDI2NjE1MnVlYXVyYQ==',
                    },
                  ],
                },
                {
                  type: 'delegate',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'dmFsaWRhdG9y',
                      index: true,
                      value:
                        'YXVyYXZhbG9wZXIxY2pwMmphMzZ6OXRkYWEwbDM3eXBrenoydmF4aDI0bGZlMnJhcWw=',
                    },
                    {
                      key: 'YW1vdW50',
                      index: true,
                      value: 'NDI2NjE1MnVlYXVyYQ==',
                    },
                    {
                      key: 'bmV3X3NoYXJlcw==',
                      index: true,
                      value: 'NDI2NjE1Mi4wMDAwMDAwMDAwMDAwMDAwMDA=',
                    },
                  ],
                },
                {
                  type: 'message',
                  msg_index: 0,
                  attributes: [
                    {
                      key: 'bW9kdWxl',
                      index: true,
                      value: 'c3Rha2luZw==',
                    },
                    {
                      key: 'c2VuZGVy',
                      index: true,
                      value:
                        'YXVyYTFjanAyamEzNno5dGRhYTBsMzd5cGt6ejJ2YXhoMjRsZnpjajRjcA==',
                    },
                  ],
                },
              ],
            },
          },
          events: [
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'coin_spent',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_spent.spender',
                  index: 0,
                  key: 'spender',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_spent.amount',
                  index: 1,
                  key: 'amount',
                  value: '200ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: null,
              type: 'coin_received',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_received.receiver',
                  index: 0,
                  key: 'receiver',
                  value: 'aura17xpfvakm2amg962yls6f84z3kell8c5lt05zfy',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_received.amount',
                  index: 1,
                  key: 'amount',
                  value: '200ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: null,
              type: 'transfer',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'transfer.recipient',
                  index: 0,
                  key: 'recipient',
                  value: 'aura17xpfvakm2amg962yls6f84z3kell8c5lt05zfy',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'transfer.sender',
                  index: 1,
                  key: 'sender',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'transfer.amount',
                  index: 2,
                  key: 'amount',
                  value: '200ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'message',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'message.sender',
                  index: 0,
                  key: 'sender',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: null,
              type: 'tx',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'tx.fee',
                  index: 0,
                  key: 'fee',
                  value: '200ueaura',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'tx.fee_payer',
                  index: 1,
                  key: 'fee_payer',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: null,
              type: 'tx',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'tx.acc_seq',
                  index: 0,
                  key: 'acc_seq',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp/399168',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: null,
              type: 'tx',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'tx.signature',
                  index: 0,
                  key: 'signature',
                  value:
                    'iuvPULPJ5tPGvdwWANGDO93jaGI48cySrmQkJpuKJlMaRFOXm7voAFkCDz2oORXqaH0uuUYRZ2BnhEr1lWueKw==',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'message',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'message.action',
                  index: 0,
                  key: 'action',
                  value: '/cosmos.staking.v1beta1.MsgDelegate',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'coin_spent',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_spent.spender',
                  index: 0,
                  key: 'spender',
                  value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_spent.amount',
                  index: 1,
                  key: 'amount',
                  value: '672714ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'coin_received',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_received.receiver',
                  index: 0,
                  key: 'receiver',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_received.amount',
                  index: 1,
                  key: 'amount',
                  value: '672714ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'transfer',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'transfer.recipient',
                  index: 0,
                  key: 'recipient',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'transfer.sender',
                  index: 1,
                  key: 'sender',
                  value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'transfer.amount',
                  index: 2,
                  key: 'amount',
                  value: '672714ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'message',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'message.sender',
                  index: 0,
                  key: 'sender',
                  value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'withdraw_rewards',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'withdraw_rewards.amount',
                  index: 0,
                  key: 'amount',
                  value: '672714ueaura',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'withdraw_rewards.validator',
                  index: 1,
                  key: 'validator',
                  value: 'auravaloper1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfe2raql',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'coin_spent',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_spent.spender',
                  index: 0,
                  key: 'spender',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_spent.amount',
                  index: 1,
                  key: 'amount',
                  value: '4266152ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'coin_received',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_received.receiver',
                  index: 0,
                  key: 'receiver',
                  value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'coin_received.amount',
                  index: 1,
                  key: 'amount',
                  value: '4266152ueaura',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'delegate',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'delegate.validator',
                  index: 0,
                  key: 'validator',
                  value: 'auravaloper1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfe2raql',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'delegate.amount',
                  index: 1,
                  key: 'amount',
                  value: '4266152ueaura',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'delegate.new_shares',
                  index: 2,
                  key: 'new_shares',
                  value: '4266152.000000000000000000',
                },
              ],
            },
            {
              source: 'TX_EVENT',
              tx_msg_index: 0,
              type: 'message',
              attributes: [
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'message.module',
                  index: 0,
                  key: 'module',
                  value: 'staking',
                },
                {
                  tx_id: '#ref{transaction-marked.id}',
                  block_height: 1,
                  composite_key: 'message.sender',
                  index: 1,
                  key: 'sender',
                  value: 'aura1cjp2ja36z9tdaa0l37ypkzz2vaxh24lfzcj4cp',
                },
              ],
            },
          ],
        },
      ],
    };
    await knex.transaction(async (trx) => {
      await Block.query()
        .insertGraph(blockData, { allowRefs: true })
        .transacting(trx);
      const tx = await Transaction.query()
        .findOne({
          hash: 'xxx',
        })
        .withGraphFetched('events.[attributes]')
        .modifyGraph('events', (builder) => {
          builder.orderBy('id', 'asc');
        })
        .modifyGraph('events.[attributes]', (builder) => {
          builder.orderBy('index', 'asc');
        })
        .transacting(trx);
      this.crawlTxService?.setMsgIndexToEvent(tx?.data);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { eventPatchInTx, txPatchInTx } =
        // eslint-disable-next-line no-unsafe-optional-chaining
        this.reassignMsgIndexService?.generateListUpdateMsgIndex(trx, tx);
      await Promise.all([...eventPatchInTx, ...txPatchInTx]);
    });
    const tx = await Transaction.query()
      .findOne({
        hash: 'xxx',
      })
      .withGraphFetched('events.[attributes]')
      .modifyGraph('events', (builder) => {
        builder.orderBy('id', 'asc');
      })
      .modifyGraph('events.[attributes]', (builder) => {
        builder.orderBy('index', 'asc');
      });
    expect(tx?.events[0].tx_msg_index).toEqual(null);
    expect(tx?.events[1].tx_msg_index).toEqual(null);
    expect(tx?.events[2].tx_msg_index).toEqual(null);
    expect(tx?.events[3].tx_msg_index).toEqual(null);
    expect(tx?.events[4].tx_msg_index).toEqual(null);
    expect(tx?.events[5].tx_msg_index).toEqual(null);
    expect(tx?.events[6].tx_msg_index).toEqual(null);
    expect(tx?.events[7].tx_msg_index).toEqual(0);
    expect(tx?.events[8].tx_msg_index).toEqual(0);
    expect(tx?.events[9].tx_msg_index).toEqual(0);
    expect(tx?.events[10].tx_msg_index).toEqual(0);
    expect(tx?.events[11].tx_msg_index).toEqual(0);
    expect(tx?.events[12].tx_msg_index).toEqual(0);
    expect(tx?.events[13].tx_msg_index).toEqual(0);
    expect(tx?.events[14].tx_msg_index).toEqual(0);
    expect(tx?.events[15].tx_msg_index).toEqual(0);
    expect(tx?.events[16].tx_msg_index).toEqual(0);
  }

  @AfterEach()
  async tearDown() {
    await Promise.all([
      knex.raw(
        'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
      ),
    ]);
  }
}

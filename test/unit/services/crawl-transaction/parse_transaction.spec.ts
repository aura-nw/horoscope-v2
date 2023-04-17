import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Log } from '@cosmjs/stargate/build/logs';
import { Attribute, Event } from '@cosmjs/stargate/build/events';
import {
  Transaction,
  Event as EventModel,
  Block,
} from '../../../../src/models';
import { BULL_JOB_NAME } from '../../../../src/common';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import knex from '../../../../src/common/utils/db_connection';

@Describe('Test crawl transaction service')
export default class CrawlTransactionTest {
  txs = [
    {
      hash: '5F38B0C3E9FAB4423C37FB6306AC06D983AF50013BC7BCFBD9F684D6BFB0AF23',
      height: '423136',
      index: 0,
      tx_result: {
        code: 0,
        data: 'CjkKNy9jb3Ntb3MuZGlzdHJpYnV0aW9uLnYxYmV0YTEuTXNnV2l0aGRyYXdEZWxlZ2F0b3JSZXdhcmQKPQo7L2Nvc21vcy5kaXN0cmlidXRpb24udjFiZXRhMS5Nc2dXaXRoZHJhd1ZhbGlkYXRvckNvbW1pc3Npb24=',
        log: '[{"events":[{"type":"coin_received","attributes":[{"key":"receiver","value":"aura12pku6jshmeekleg5sfhdt50a4sxjlrhuqw2rku"},{"key":"amount","value":"340104uaura"}]},{"type":"coin_spent","attributes":[{"key":"spender","value":"aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx"},{"key":"amount","value":"340104uaura"}]},{"type":"message","attributes":[{"key":"action","value":"/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"},{"key":"sender","value":"aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx"},{"key":"module","value":"distribution"},{"key":"sender","value":"aura12pku6jshmeekleg5sfhdt50a4sxjlrhuqw2rku"}]},{"type":"transfer","attributes":[{"key":"recipient","value":"aura12pku6jshmeekleg5sfhdt50a4sxjlrhuqw2rku"},{"key":"sender","value":"aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx"},{"key":"amount","value":"340104uaura"}]},{"type":"withdraw_rewards","attributes":[{"key":"amount","value":"340104uaura"},{"key":"validator","value":"auravaloper12pku6jshmeekleg5sfhdt50a4sxjlrhumumtwz"}]}]},{"msg_index":1,"events":[{"type":"coin_received","attributes":[{"key":"receiver","value":"aura12pku6jshmeekleg5sfhdt50a4sxjlrhuqw2rku"},{"key":"amount","value":"223509uaura"}]},{"type":"coin_spent","attributes":[{"key":"spender","value":"aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx"},{"key":"amount","value":"223509uaura"}]},{"type":"message","attributes":[{"key":"action","value":"/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission"},{"key":"sender","value":"aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx"},{"key":"module","value":"distribution"},{"key":"sender","value":"auravaloper12pku6jshmeekleg5sfhdt50a4sxjlrhumumtwz"}]},{"type":"transfer","attributes":[{"key":"recipient","value":"aura12pku6jshmeekleg5sfhdt50a4sxjlrhuqw2rku"},{"key":"sender","value":"aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx"},{"key":"amount","value":"223509uaura"}]},{"type":"withdraw_commission","attributes":[{"key":"amount","value":"223509uaura"}]}]}]',
        info: '',
        gas_wanted: '200000',
        gas_used: '142624',
        events: [
          {
            type: 'coin_spent',
            attributes: [
              {
                key: 'c3BlbmRlcg==',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MjAwdWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'coin_received',
            attributes: [
              {
                key: 'cmVjZWl2ZXI=',
                value:
                  'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MjAwdWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'transfer',
            attributes: [
              {
                key: 'cmVjaXBpZW50',
                value:
                  'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MjAwdWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
            ],
          },
          {
            type: 'tx',
            attributes: [
              {
                key: 'ZmVl',
                value: 'MjAwdWF1cmE=',
                index: true,
              },
              {
                key: 'ZmVlX3BheWVy',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
            ],
          },
          {
            type: 'tx',
            attributes: [
              {
                key: 'YWNjX3NlcQ==',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdS8yNDQ5',
                index: true,
              },
            ],
          },
          {
            type: 'tx',
            attributes: [
              {
                key: 'c2lnbmF0dXJl',
                value:
                  'QjFRczdlZ2NMU0laWkgzMkErNzF2a0FzRjBTeG42emtsNHFuSnh2OGVmb2dtNVJydHJZTFY4cDFJdVJTSnp5eVAxTDVKZUJEQ1JjaHFERGlrQmJ6L3c9PQ==',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'YWN0aW9u',
                value:
                  'L2Nvc21vcy5kaXN0cmlidXRpb24udjFiZXRhMS5Nc2dXaXRoZHJhd0RlbGVnYXRvclJld2FyZA==',
                index: true,
              },
            ],
          },
          {
            type: 'coin_spent',
            attributes: [
              {
                key: 'c3BlbmRlcg==',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MzQwMTA0dWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'coin_received',
            attributes: [
              {
                key: 'cmVjZWl2ZXI=',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MzQwMTA0dWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'transfer',
            attributes: [
              {
                key: 'cmVjaXBpZW50',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MzQwMTA0dWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
            ],
          },
          {
            type: 'withdraw_rewards',
            attributes: [
              {
                key: 'YW1vdW50',
                value: 'MzQwMTA0dWF1cmE=',
                index: true,
              },
              {
                key: 'dmFsaWRhdG9y',
                value:
                  'YXVyYXZhbG9wZXIxMnBrdTZqc2htZWVrbGVnNXNmaGR0NTBhNHN4amxyaHVtdW10d3o=',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'bW9kdWxl',
                value: 'ZGlzdHJpYnV0aW9u',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'YWN0aW9u',
                value:
                  'L2Nvc21vcy5kaXN0cmlidXRpb24udjFiZXRhMS5Nc2dXaXRoZHJhd1ZhbGlkYXRvckNvbW1pc3Npb24=',
                index: true,
              },
            ],
          },
          {
            type: 'coin_spent',
            attributes: [
              {
                key: 'c3BlbmRlcg==',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MjIzNTA5dWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'coin_received',
            attributes: [
              {
                key: 'cmVjZWl2ZXI=',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MjIzNTA5dWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'transfer',
            attributes: [
              {
                key: 'cmVjaXBpZW50',
                value:
                  'YXVyYTEycGt1NmpzaG1lZWtsZWc1c2ZoZHQ1MGE0c3hqbHJodXF3MnJrdQ==',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
              {
                key: 'YW1vdW50',
                value: 'MjIzNTA5dWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYTFqdjY1czNncnFmNnY2amwzZHA0dDZjOXQ5cms5OWNkOHVmbjd0eA==',
                index: true,
              },
            ],
          },
          {
            type: 'withdraw_commission',
            attributes: [
              {
                key: 'YW1vdW50',
                value: 'MjIzNTA5dWF1cmE=',
                index: true,
              },
            ],
          },
          {
            type: 'message',
            attributes: [
              {
                key: 'bW9kdWxl',
                value: 'ZGlzdHJpYnV0aW9u',
                index: true,
              },
              {
                key: 'c2VuZGVy',
                value:
                  'YXVyYXZhbG9wZXIxMnBrdTZqc2htZWVrbGVnNXNmaGR0NTBhNHN4amxyaHVtdW10d3o=',
                index: true,
              },
            ],
          },
        ],
        codespace: '',
      },
      tx: 'CpQCCpwBCjcvY29zbW9zLmRpc3RyaWJ1dGlvbi52MWJldGExLk1zZ1dpdGhkcmF3RGVsZWdhdG9yUmV3YXJkEmEKK2F1cmExMnBrdTZqc2htZWVrbGVnNXNmaGR0NTBhNHN4amxyaHVxdzJya3USMmF1cmF2YWxvcGVyMTJwa3U2anNobWVla2xlZzVzZmhkdDUwYTRzeGpscmh1bXVtdHd6CnMKOy9jb3Ntb3MuZGlzdHJpYnV0aW9uLnYxYmV0YTEuTXNnV2l0aGRyYXdWYWxpZGF0b3JDb21taXNzaW9uEjQKMmF1cmF2YWxvcGVyMTJwa3U2anNobWVla2xlZzVzZmhkdDUwYTRzeGpscmh1bXVtdHd6EmcKUQpGCh8vY29zbW9zLmNyeXB0by5zZWNwMjU2azEuUHViS2V5EiMKIQOxEYuQv4wegGfSTUuqovipYdmXvu6PJBro71MKqDe8/RIECgIIARiRExISCgwKBXVhdXJhEgMyMDAQwJoMGkAHVCzt6BwtIhlkffYD7vW+QCwXRLGfrOSXiqcnG/x5+iCblGu2tgtXynUi5FInPLI/Uvkl4EMJFyGoMOKQFvP/',
    },
  ];

  broker = new ServiceBroker({ logger: false });

  crawlTxService?: CrawlTxService;

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;
    await Promise.all([
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_TRANSACTION)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_TRANSACTION)
        .empty(),
      knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE'),
      Block.query().insert(
        Block.fromJson({
          height: 423136,
          hash: 'data hash',
          time: '2023-04-17T03:44:41.000Z',
          proposer_address: 'proposer address',
          data: {},
        })
      ),
    ]);
  }

  @Test('Parse transaction and insert to DB')
  public async testHandleTransaction() {
    this.crawlTxService?.createJob(
      BULL_JOB_NAME.HANDLE_TRANSACTION,
      BULL_JOB_NAME.HANDLE_TRANSACTION,
      {
        listTx: { txs: this.txs },
        height: 423136,
        timestamp: '2023-04-17T03:44:41.000Z',
      }
    );
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 2000));
    const tx = await Transaction.query().findOne(
      'hash',
      '5F38B0C3E9FAB4423C37FB6306AC06D983AF50013BC7BCFBD9F684D6BFB0AF23'
    );
    expect(tx).not.toBeUndefined();
    if (tx) {
      const logs = JSON.parse(this.txs[0].tx_result.log);
      logs.forEach(async (log: Log) => {
        const msgIndex = log.msg_index ?? 0;
        log.events.forEach(async (event: Event) => {
          event.attributes.forEach(async (attribute: Attribute) => {
            const found = await EventModel.query()
              .select('value')
              .joinRelated('attributes')
              .where('event.tx_msg_index', msgIndex)
              .andWhere('event.tx_id', tx.id)
              .andWhere(
                'attributes.composite_key',
                `${event.type}.${attribute.key}`
              )
              .andWhere('value', attribute.value);

            expect(found).not.toBeUndefined();
            expect(found.length).not.toEqual(0);
          });
        });
      });
    }
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_TRANSACTION)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_TRANSACTION)
        .empty(),
    ]);
    await Promise.all([
      knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE'),
      this.crawlTxService?._stop(),
    ]);
  }
}

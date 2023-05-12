import { AfterEach, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import HandleTxVoteService from '../../../../src/services/handle-vote/handle_vote_tx.service';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import knex from '../../../../src/common/utils/db_connection';
import { Block, BlockCheckpoint, Vote } from '../../../../src/models';
import tx_fixture_vote from './tx_vote.fixture.json' assert { type: 'json' };
import tx_fixture_vote_authz from './tx_vote_authz.fixture.json' assert { type: 'json' };
import HandleAuthzTxService from '../../../../src/services/crawl-tx/handle_authz_tx.service';

@Describe('Test handle voting tx service')
export default class HandleTxVoteServiceTest {
  broker = new ServiceBroker({ logger: false });

  handleVoteTxService?: HandleTxVoteService;

  crawlTxService?: CrawlTxService;

  handleAuthzTxServive?: HandleAuthzTxService;

  @BeforeEach()
  async initSuite() {
    this.handleVoteTxService = this.broker.createService(
      HandleTxVoteService
    ) as HandleTxVoteService;
    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;
    this.handleAuthzTxServive = this.broker.createService(
      HandleAuthzTxService
    ) as HandleAuthzTxService;
    await Promise.all([
      this.handleVoteTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_VOTE_TX)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_TRANSACTION)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_TRANSACTION)
        .empty(),
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE vote RESTART IDENTITY CASCADE'),
    ]);

    // await this.crawlTxService._start();
    // await this.handleVoteTxService._start();
  }

  @Test('Handle voting simple tx')
  async handleVoteTx() {
    await BlockCheckpoint.query().insert(
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        height: 4279200,
      })
    );

    await Block.query().insert(
      Block.fromJson({
        height: 4279260,
        hash: 'data hash authz',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );
    await this.crawlTxService?.jobHandlerTx({
      listTx: { ...tx_fixture_vote },
      height: 4279260,
      timestamp: '2023-04-17T03:44:41.000Z',
    });
    await this.handleVoteTxService?.initEnv();
    await this.handleVoteTxService?.handleVote();
    const vote = await Vote.query()
      .where('proposal_id', 18)
      .andWhere('voter', 'aura1x974kw0xsasgr574h9vpaggg8dhn7yxgffvxu8')
      .andWhere('vote_option', 'VOTE_OPTION_YES');
    expect(vote.length).toEqual(1);
  }

  @Test('Handle voting in authz tx')
  async handleVoteAuthzTx() {
    await BlockCheckpoint.query().insert(
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        height: 4279300,
      })
    );

    await Block.query().insert(
      Block.fromJson({
        height: 4279400,
        hash: 'data hash authz',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );
    await this.crawlTxService?.jobHandlerTx({
      listTx: { ...tx_fixture_vote_authz },
      height: 4279400,
      timestamp: '2023-04-17T03:44:41.000Z',
    });

    await this.handleAuthzTxServive?.initEnv();
    await this.handleAuthzTxServive?.handleJob();

    await this.handleVoteTxService?.initEnv();
    await this.handleVoteTxService?.handleVote();

    const vote = await Vote.query()
      .where('proposal_id', 2)
      .andWhere('voter', 'aura1dyw4kvnfzj9geh75jlw4z2tgmj5g9f354wteel')
      .andWhere('vote_option', 'VOTE_OPTION_YES');
    expect(vote.length).toEqual(1);
  }

  @AfterEach()
  async tearDown() {
    await Promise.all([
      this.handleVoteTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_VOTE_TX)
        .empty(),
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
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE vote RESTART IDENTITY CASCADE'),
      this.handleVoteTxService?._stop(),
      this.crawlTxService?._stop(),
      this.broker.stop(),
    ]);
  }
}

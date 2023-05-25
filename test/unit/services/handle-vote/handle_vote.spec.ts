import { AfterEach, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import HandleTxVoteService from '../../../../src/services/handle-vote/handle_vote_tx.service';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import knex from '../../../../src/common/utils/db_connection';
import { Block, BlockCheckpoint, Vote } from '../../../../src/models';
import tx_fixture_vote from './tx_vote.fixture.json' assert { type: 'json' };
import tx_fixture_multi_vote from './tx_multi_vote.fixture.json' assert { type: 'json' };
import tx_fixture_vote_authz from './tx_vote_authz.fixture.json' assert { type: 'json' };
import tx_fixture_vote_option_yes from './tx_vote_change_option_yes.fixture.json' assert { type: 'json' };
import tx_fixture_vote_option_no from './tx_vote_change_option_no.fixture.json' assert { type: 'json' };
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
      this.crawlTxService._start(),
      this.handleVoteTxService._start(),
      this.handleAuthzTxServive._start(),
    ]);
    this.handleVoteTxService?.getQueueManager().stopAll();
    this.crawlTxService?.getQueueManager().stopAll();
    this.handleAuthzTxServive?.getQueueManager().stopAll();
    await Promise.all([
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE vote RESTART IDENTITY CASCADE'),
    ]);
  }

  @Test('Handle voting simple tx')
  async handleVoteTx() {
    await BlockCheckpoint.query().insert([
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        height: 4279200,
      }),
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        height: 4279260,
      }),
    ]);

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
    await BlockCheckpoint.query().insert([
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        height: 4279300,
      }),
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        height: 4279300,
      }),
    ]);

    await Block.query().insert(
      Block.fromJson({
        height: 4279350,
        hash: 'data hash authz',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );
    await this.crawlTxService?.jobHandlerTx({
      listTx: { ...tx_fixture_vote_authz },
      height: 4279350,
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

  @Test('Handle change voting option')
  async changeVoteTx() {
    await BlockCheckpoint.query().insert([
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        height: 6794600,
      }),
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        height: 6794619,
      }),
    ]);

    await Block.query().insert([
      Block.fromJson({
        height: 6794608,
        hash: 'data hash block 1',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      }),
      Block.fromJson({
        height: 6794619,
        hash: 'data hash block 2',
        time: '2023-04-17T03:45:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      }),
    ]);
    await this.crawlTxService?.jobHandlerTx({
      listTx: { ...tx_fixture_vote_option_yes },
      height: 6794608,
      timestamp: '2023-04-17T03:44:41.000Z',
    });
    await this.crawlTxService?.jobHandlerTx({
      listTx: { ...tx_fixture_vote_option_no },
      height: 6794619,
      timestamp: '2023-04-17T03:45:41.000Z',
    });
    await this.handleVoteTxService?.initEnv();
    await this.handleVoteTxService?.handleVote();
    const vote = await Vote.query()
      .where('proposal_id', 427)
      .andWhere('voter', 'aura145wvhwnjl8nlqpl990w4s6wa7yw88s6njzkjxv')
      .andWhere('vote_option', 'VOTE_OPTION_NO');
    expect(vote.length).toEqual(1);
  }

  @Test('Handle multivote to one proposal')
  async handleMultiVote() {
    await BlockCheckpoint.query().insert([
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        height: 4279200,
      }),
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        height: 4279260,
      }),
    ]);

    await Block.query().insert(
      Block.fromJson({
        height: 4279260,
        hash: 'data hash block',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );
    await this.crawlTxService?.jobHandlerTx({
      listTx: { ...tx_fixture_multi_vote },
      height: 4279260,
      timestamp: '2023-04-17T03:44:41.000Z',
    });

    await this.handleVoteTxService?.initEnv();
    await this.handleVoteTxService?.handleVote();
    const vote = await Vote.query()
      .where('proposal_id', 428)
      .andWhere('voter', 'aura17dv9s7hujzkruzmezeg4l39zfuks7mjfscddcm')
      .andWhere('vote_option', 'VOTE_OPTION_NO');
    expect(vote.length).toEqual(1);
  }

  @AfterEach()
  async tearDown() {
    this.handleVoteTxService?.getQueueManager().stopAll();
    this.crawlTxService?.getQueueManager().stopAll();
    this.handleAuthzTxServive?.getQueueManager().stopAll();
    await Promise.all([
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE vote RESTART IDENTITY CASCADE'),
      this.handleVoteTxService?._stop(),
      this.crawlTxService?._stop(),
      this.handleAuthzTxServive?._stop(),
      this.broker.stop(),
    ]);
  }
}

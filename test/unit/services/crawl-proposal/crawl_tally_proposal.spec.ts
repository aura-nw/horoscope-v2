import { coins, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import {
  assertIsDeliverTxSuccess,
  MsgSubmitProposalEncodeObject,
  MsgVoteEncodeObject,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { cosmos } from '@aura-nw/aurajs';
import { BULL_JOB_NAME } from '../../../../src/common';
import { Account, Proposal } from '../../../../src/models';
import CrawlTallyProposalService from '../../../../src/services/crawl-proposal/crawl_tally_proposal.service';
import config from '../../../../config.json' assert { type: 'json' };
import network from '../../../../network.json' assert { type: 'json' };
import {
  defaultSendFee,
  defaultSigningClientOptions,
} from '../../../helper/constant';
import knex from '../../../../src/common/utils/db_connection';

@Describe('Test crawl_tally_proposal service')
export default class CrawlTallyProposalTest {
  account = {
    ...Account.fromJson({
      address: 'aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9',
      balances: [],
      spendable_balances: [],
      type: null,
      pubkey: {},
      account_number: 0,
      sequence: 0,
    }),
    proposals: {
      proposal_id: 1,
      voting_start_time: '2023-04-10T07:28:12.328245471Z',
      voting_end_time: new Date(new Date().getSeconds() - 10).toISOString(),
      submit_time: '2023-04-10T07:28:12.328245471Z',
      deposit_end_time: '2023-04-10T07:38:12.328245471Z',
      type: '/cosmos.gov.v1beta1.TextProposal',
      title: 'Community Pool Spend test 1',
      description: 'Test 1',
      content: {
        '@type': '/cosmos.gov.v1beta1.TextProposal',
        title: 'Community Pool Spend test 1',
        description: 'Test 1',
      },
      status: 'PROPOSAL_STATUS_VOTING_PERIOD',
      tally: {
        yes: '0',
        no: '0',
        abstain: '0',
        no_with_veto: '0',
      },
      initial_deposit: [
        {
          denom: 'uaura',
          amount: '100000',
        },
      ],
      total_deposit: [
        {
          denom: 'uaura',
          amount: '10000000',
        },
      ],
      turnout: 0,
    },
  };

  broker = new ServiceBroker({ logger: false });

  crawlTallyProposalService?: CrawlTallyProposalService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    this.crawlTallyProposalService = this.broker.createService(
      CrawlTallyProposalService
    ) as CrawlTallyProposalService;
    await this.crawlTallyProposalService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL)
      .empty();
    await knex.raw('TRUNCATE TABLE account RESTART IDENTITY CASCADE');
    await Account.query().insertGraph(this.account).returning('*');
  }

  @AfterAll()
  async tearDown() {
    await knex.raw('TRUNCATE TABLE account RESTART IDENTITY CASCADE');
    await this.broker.stop();
  }

  @Test('Crawl proposal tally success')
  public async testCrawlTallyProposal() {
    const amount = coins(10000000, 'uaura');
    const memoSubmitProposal = 'test create proposal';
    const memoVote = 'test vote';
    const memoDelegate = 'test delegate';

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      'symbol force gallery make bulk round subway violin worry mixture penalty kingdom boring survey tool fringe patrol sausage hard admit remember broken alien absorb',
      {
        prefix: 'aura',
      }
    );
    const client = await SigningStargateClient.connectWithSigner(
      network.find((net) => net.chainId === config.chainId)?.RPC[0] ?? '',
      wallet,
      defaultSigningClientOptions
    );

    const msgSubmitProposal: MsgSubmitProposalEncodeObject = {
      typeUrl: '/cosmos.gov.v1beta1.MsgSubmitProposal',
      value: cosmos.gov.v1beta1.MsgSubmitProposal.fromPartial({
        content: {
          typeUrl: '/cosmos.gov.v1beta1.TextProposal',
          value: Uint8Array.from(
            cosmos.gov.v1beta1.TextProposal.encode(
              cosmos.gov.v1beta1.TextProposal.fromPartial({
                title: 'Community Pool Spend test 1',
                description: 'Test 1',
              })
            ).finish()
          ),
        },
        initialDeposit: amount,
        proposer: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      }),
    };
    let result = await client.signAndBroadcast(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      [msgSubmitProposal],
      defaultSendFee,
      memoSubmitProposal
    );
    assertIsDeliverTxSuccess(result);

    const msgVoteYes: MsgVoteEncodeObject = {
      typeUrl: '/cosmos.gov.v1beta1.MsgVote',
      value: cosmos.gov.v1beta1.MsgVote.fromPartial({
        proposalId: 1,
        option: cosmos.gov.v1beta1.VoteOption.VOTE_OPTION_YES,
        voter: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      }),
    };
    result = await client.signAndBroadcast(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      [msgVoteYes],
      defaultSendFee,
      memoVote
    );
    assertIsDeliverTxSuccess(result);

    result = await client.delegateTokens(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
      amount[0],
      defaultSendFee,
      memoDelegate
    );
    assertIsDeliverTxSuccess(result);

    await this.crawlTallyProposalService?.handleJob({
      proposalId: 1,
    });

    const updatedProposal: Proposal | undefined = await Proposal.query()
      .where('proposal_id', 1)
      .first();

    expect(updatedProposal?.tally).toEqual({
      no: '0',
      yes: '10000000',
      abstain: '0',
      no_with_veto: '0',
    });
    expect(updatedProposal?.turnout).toEqual(9.090909);
  }
}

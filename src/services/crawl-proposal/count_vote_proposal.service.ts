import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import { Proposal, Vote } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CountVoteProposalService.key,
  version: 1,
})
export default class CountVoteProposalService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.COUNT_VOTE_PROPOSAL,
    jobName: BULL_JOB_NAME.COUNT_VOTE_PROPOSAL,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const now = new Date(Date.now() - 10);
    const prev = new Date(Date.now() - 30);
    const votingProposals = await Proposal.query()
      .where('status', Proposal.STATUS.PROPOSAL_STATUS_VOTING_PERIOD)
      .orWhere((builder) =>
        builder
          .whereIn('status', [
            Proposal.STATUS.PROPOSAL_STATUS_FAILED,
            Proposal.STATUS.PROPOSAL_STATUS_PASSED,
            Proposal.STATUS.PROPOSAL_STATUS_REJECTED,
          ])
          .andWhere('voting_end_time', '<=', now)
          .andWhere('voting_end_time', '>', prev)
      )
      .select('*');

    votingProposals.forEach(async (proposal: Proposal) => {
      const proposalId = proposal.proposal_id;
      this.logger.info('Count vote for proposal id ', proposalId);

      await knex.transaction(async (trx) => {
        const [
          countVoteYes,
          countVoteNo,
          countVoteNoWithVeto,
          countVoteAbstain,
          countVoteUnspecified,
        ] = await Promise.all([
          Vote.query()
            .where('proposal_id', proposalId)
            .andWhere('vote_option', Vote.VOTE_OPTION.VOTE_OPTION_YES)
            .count()
            .transacting(trx),
          Vote.query()
            .where('proposal_id', proposalId)
            .andWhere('vote_option', Vote.VOTE_OPTION.VOTE_OPTION_NO)
            .count()
            .transacting(trx),
          Vote.query()
            .where('proposal_id', proposalId)
            .andWhere('vote_option', Vote.VOTE_OPTION.VOTE_OPTION_NO_WITH_VETO)
            .count()
            .transacting(trx),
          Vote.query()
            .where('proposal_id', proposalId)
            .andWhere('vote_option', Vote.VOTE_OPTION.VOTE_OPTION_ABSTAIN)
            .count()
            .transacting(trx),
          Vote.query()
            .where('proposal_id', proposalId)
            .andWhere('vote_option', Vote.VOTE_OPTION.VOTE_OPTION_UNSPECIFIED)
            .count()
            .transacting(trx),
        ]);

        await Proposal.query()
          .where('proposal_id', proposalId)
          .patch({
            count_vote: {
              yes: countVoteYes[0].count,
              no: countVoteNo[0].count,
              abstain: countVoteAbstain[0].count,
              no_with_veto: countVoteNoWithVeto[0].count,
              unspecified: countVoteUnspecified[0].count,
            },
          })
          .transacting(trx);
      });
    });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.COUNT_VOTE_PROPOSAL,
      BULL_JOB_NAME.COUNT_VOTE_PROPOSAL,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.countVoteProposal.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}

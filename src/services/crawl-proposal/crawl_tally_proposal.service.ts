import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import {
  BULL_JOB_NAME,
  getLcdClient,
  IAuraJSClientFactory,
  IProposalIdParam,
  SERVICE,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Proposal } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.CrawlTallyProposalService.key,
  version: 1,
})
export default class CrawlTallyProposalService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.CrawlTallyProposalService.UpdateProposalTally.key,
    params: {
      proposalId: 'number',
    },
  })
  public actionProposalTallyUpsert(ctx: Context<IProposalIdParam>) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL,
      'crawl',
      {
        proposalId: ctx.params.proposalId,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: IProposalIdParam): Promise<void> {
    this._lcdClient = await getLcdClient();

    const [proposalTally, pool] = await Promise.all([
      this._lcdClient.auranw.cosmos.gov.v1beta1.tallyResult({
        proposalId: _payload.proposalId,
      }),
      this._lcdClient.auranw.cosmos.staking.v1beta1.pool(),
    ]);

    const { tally } = proposalTally;
    let turnout = 0;
    if (pool && pool.pool) {
      turnout =
        Number(
          ((BigInt(tally.yes) +
            BigInt(tally.no) +
            BigInt(tally.abstain) +
            BigInt(tally.no_with_veto)) *
            BigInt(100000000)) /
            BigInt(pool.pool.bonded_tokens)
        ) / 1000000;
    }

    await Proposal.query()
      .patch({
        tally,
        turnout,
      })
      .where({ proposal_id: _payload.proposalId });
  }
}

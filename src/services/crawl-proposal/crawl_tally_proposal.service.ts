import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { IAuraJSClientFactory } from '../../common/types/interfaces';
import {
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  CONST_CHAR,
  SERVICE_NAME,
} from '../../common/constant';
import { IProposalIdParam } from '../../common/utils/request';
import { Config } from '../../common';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { Proposal } from '../../models/proposal';

@Service({
  name: SERVICE_NAME.CRAWL_TALLY_PROPOSAL,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class CrawlTallyProposalService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: BULL_ACTION_NAME.PROPOSAL_TALLY_UPSERT,
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
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
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

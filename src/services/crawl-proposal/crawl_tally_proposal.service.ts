import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  QueryTallyResultRequest,
  QueryTallyResultResponse,
} from '@aura-nw/aurajs/types/codegen/cosmos/gov/v1beta1/query';
import Long from 'long';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { cosmos } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import config from '../../../config.json' assert { type: 'json' };
import { Proposal } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
  IAuraJSClientFactory,
  SERVICE,
} from '../../common';

@Service({
  name: SERVICE.V1.CrawlTallyProposalService.key,
  version: 1,
})
export default class CrawlTallyProposalService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL,
    jobName: 'crawl',
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const batchQueries: any[] = [];

    const now = new Date(new Date().getSeconds() - 10);
    const prev = new Date(new Date().getSeconds() - 30);
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

    votingProposals.forEach((proposal: Proposal) => {
      const request: QueryTallyResultRequest = {
        proposalId: Long.fromInt(proposal.proposal_id),
      };
      const data = toHex(
        cosmos.gov.v1beta1.QueryTallyResultRequest.encode(request).finish()
      );

      batchQueries.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.TALLY_RESULT,
            data,
          })
        )
      );
    });

    const pool = await this._lcdClient.auranw.cosmos.staking.v1beta1.pool();
    const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
    const proposalTally: QueryTallyResultResponse[] = result.map(
      (res: JsonRpcSuccessResponse) =>
        cosmos.gov.v1beta1.QueryTallyResultResponse.decode(
          fromBase64(res.result.response.value)
        )
    );

    proposalTally.forEach((pro, index) => {
      const { tally } = pro;
      let turnout = 0;
      if (pool && pool.pool && tally) {
        turnout =
          Number(
            ((BigInt(tally.yes) +
              BigInt(tally.no) +
              BigInt(tally.abstain) +
              BigInt(tally.noWithVeto)) *
              BigInt(100000000)) /
              BigInt(pool.pool.bonded_tokens)
          ) / 1000000;
      }

      votingProposals[index].tally = {
        yes: tally?.yes || '0',
        no: tally?.no || '0',
        abstain: tally?.abstain || '0',
        no_with_veto: tally?.noWithVeto || '0',
      };
      votingProposals[index].turnout = turnout;
    });

    if (votingProposals.length > 0)
      await Proposal.query()
        .insert(votingProposals)
        .onConflict('proposal_id')
        .merge()
        .returning('proposal_id')
        .catch((error) => {
          this.logger.error('Error update proposals tally');
          this.logger.error(error);
        });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlTallyProposal.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}

import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  QueryTallyResultRequest,
  QueryTallyResultResponse,
} from '@aura-nw/aurajs/types/codegen/cosmos/gov/v1/query';
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
import Utils from '../../common/utils/utils';

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
    jobName: BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    this.logger.info('Update proposal tally');
    this._lcdClient = await getLcdClient();

    const batchQueries: any[] = [];
    const patchQueries: any[] = [];

    const now = new Date(Date.now() - 10);
    const prev = new Date(Date.now() - 30);
    // Query proposals that match the conditions to update tally and turnout
    const votingProposals = await Proposal.query()
      // Proposals that are still in the voting period
      .where('status', Proposal.STATUS.PROPOSAL_STATUS_VOTING_PERIOD)
      // Proposals that had just completed
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
      // Old proposals that finished a long time ago but just got crawled recently so its tally and turnout are missing
      .orWhere('turnout', null)
      .select('*');

    votingProposals.forEach((proposal: Proposal) => {
      const request: QueryTallyResultRequest = {
        proposalId: Long.fromInt(proposal.proposal_id),
      };
      const data = toHex(
        cosmos.gov.v1.QueryTallyResultRequest.encode(request).finish()
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

    const pool = await this._lcdClient.aura.cosmos.staking.v1beta1.pool();
    const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
    const proposalTally: QueryTallyResultResponse[] = result.map(
      (res: JsonRpcSuccessResponse) =>
        cosmos.gov.v1.QueryTallyResultResponse.decode(
          fromBase64(res.result.response.value)
        )
    );

    proposalTally.forEach((pro, index) => {
      if (pro.tally) {
        const tally = {
          yes: pro.tally.yesCount,
          no: pro.tally.noCount,
          abstain: pro.tally.abstainCount,
          noWithVeto: pro.tally.noWithVetoCount,
        };
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

        patchQueries.push(
          Proposal.query()
            .where('proposal_id', votingProposals[index].proposal_id)
            .patch({
              tally: Utils.camelizeKeys(tally),
              turnout,
            })
        );
      }
    });

    if (patchQueries.length > 0)
      await Promise.all(patchQueries).catch((error) => {
        this.logger.error(
          `Error update proposals tally: ${JSON.stringify(votingProposals)}`
        );
        this.logger.error(error);
      });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL,
      BULL_JOB_NAME.CRAWL_TALLY_PROPOSAL,
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

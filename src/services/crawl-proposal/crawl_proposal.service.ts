/* eslint-disable no-param-reassign */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  QueryProposalRequest,
  QueryProposalResponse,
} from '@aura-nw/aurajs/types/codegen/cosmos/gov/v1/query';
import Long from 'long';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { cosmos } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { GetNodeInfoResponseSDKType } from '@aura-nw/aurajs/types/codegen/cosmos/base/tendermint/v1beta1/query';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
  IAuraJSClientFactory,
  SERVICE,
} from '../../common';
import { BlockCheckpoint, Proposal, EventAttribute } from '../../models';
import Utils from '../../common/utils/utils';

@Service({
  name: SERVICE.V1.CrawlProposalService.key,
  version: 1,
})
export default class CrawlProposalService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_PROPOSAL,
    jobName: BULL_JOB_NAME.CRAWL_PROPOSAL,
  })
  public async handleCrawlProposals(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listProposals: Proposal[] = [];

    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_PROPOSAL,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.crawlProposal.key
      );
    this.logger.info(`startHeight: ${startHeight}, endHeight: ${endHeight}`);
    if (startHeight >= endHeight) return;

    let proposalIds: number[] = [];
    const resultTx = await EventAttribute.query()
      .where('block_height', '>', startHeight)
      .andWhere('block_height', '<=', endHeight)
      .andWhere('key', EventAttribute.ATTRIBUTE_KEY.PROPOSAL_ID)
      .select('value');

    if (resultTx.length > 0)
      proposalIds = Array.from(
        new Set(resultTx.map((res: any) => parseInt(res.value, 10)))
      );

    await knex
      .transaction(async (trx) => {
        if (proposalIds.length > 0) {
          const listProposalsInDb: Proposal[] = await Proposal.query().whereIn(
            'proposal_id',
            proposalIds
          );
          const nodeInfo: GetNodeInfoResponseSDKType =
            await this._lcdClient.auranw.cosmos.base.tendermint.v1beta1.getNodeInfo();
          const cosmosSdkVersion =
            nodeInfo.application_version?.cosmos_sdk_version ?? 'v0.45.99';
          await Promise.all(
            proposalIds.map(async (proposalId: number) => {
              try {
                let proposal;
                if (Utils.compareVersion(cosmosSdkVersion, 'v0.45.99') === -1) {
                  proposal =
                    await this._lcdClient.auranw.cosmos.gov.v1beta1.proposal({
                      proposalId,
                    });
                } else {
                  // use gov.v1 to call proposal
                  proposal =
                    await this._lcdClient.auranw.cosmos.gov.v1.proposal({
                      proposalId,
                    });
                  proposal.proposal = {
                    ...proposal.proposal,
                    proposal_id: proposal.proposal.id,
                    content: proposal.proposal.messages,
                    description: proposal.proposal.summary,
                    proposer: proposal.proposal.proposer,
                    final_tally_result: {
                      yes: proposal.proposal.final_tally_result.yes_count,
                      abstain:
                        proposal.proposal.final_tally_result.abstain_count,
                      no: proposal.proposal.final_tally_result.no_count,
                      no_with_veto:
                        proposal.proposal.final_tally_result.no_with_veto_count,
                    },
                  };
                }

                const foundProposal: Proposal | undefined =
                  listProposalsInDb.find(
                    (pro: Proposal) => pro.proposal_id === proposalId
                  );

                let proposalEntity: Proposal;
                if (!foundProposal) {
                  const [proposerAddress, initialDeposit] =
                    await Proposal.getProposerBySearchTx(
                      proposal.proposal.proposal_id
                    );

                  proposalEntity = Proposal.createNewProposal(
                    proposal.proposal,
                    proposerAddress,
                    initialDeposit
                  );
                } else {
                  proposalEntity = foundProposal;
                  proposalEntity.status = proposal.proposal.status;
                  proposalEntity.total_deposit =
                    proposal.proposal.total_deposit;
                  proposalEntity.voting_start_time =
                    proposal.proposal.voting_start_time;
                  proposalEntity.voting_end_time =
                    proposal.proposal.voting_end_time;
                }

                listProposals.push(proposalEntity);
              } catch (error) {
                this.logger.error(`Error get proposal ${proposalId}`);
                this.logger.debug(error);
                throw error;
              }
            })
          );

          if (listProposals.length > 0)
            await Proposal.query()
              .insert(listProposals)
              .onConflict('proposal_id')
              .merge()
              .returning('proposal_id')
              .transacting(trx)
              .catch((error) => {
                this.logger.error(
                  `Error insert or update proposals: ${JSON.stringify(
                    listProposals
                  )}`
                );
                this.logger.error(error);
                throw error;
              });
        }

        updateBlockCheckpoint.height = endHeight;
        await BlockCheckpoint.query()
          .insert(updateBlockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      })
      .catch((error) => {
        this.logger.error(error);
        throw error;
      });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ENDED_PROPOSAL,
    jobName: BULL_JOB_NAME.HANDLE_ENDED_PROPOSAL,
  })
  public async handleEndedProposals(_payload: object): Promise<void> {
    const batchQueries: any[] = [];
    const patchQueries: any[] = [];

    const current10SecsAgo = new Date(Date.now() - 10);

    const endedProposals = await Proposal.query()
      .where('status', Proposal.STATUS.PROPOSAL_STATUS_VOTING_PERIOD)
      .andWhere('voting_end_time', '<=', current10SecsAgo);

    endedProposals.forEach((proposal: Proposal) => {
      const request: QueryProposalRequest = {
        proposalId: Long.fromInt(proposal.proposal_id),
      };
      const data = toHex(
        cosmos.gov.v1.QueryProposalRequest.encode(request).finish()
      );

      batchQueries.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.PROPOSAL,
            data,
          })
        )
      );
    });

    const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
    const resultProposals: (QueryProposalResponse | null)[] = result.map(
      (res: JsonRpcSuccessResponse) =>
        res.result.response.value
          ? cosmos.gov.v1.QueryProposalResponse.decode(
              fromBase64(res.result.response.value)
            )
          : null
    );

    endedProposals.forEach((proposal: Proposal) => {
      const onchainPro = resultProposals.find((pro) =>
        pro?.proposal?.id.equals(Long.fromInt(proposal.proposal_id))
      );
      if (onchainPro) {
        patchQueries.push(
          Proposal.query()
            .where('proposal_id', proposal.proposal_id)
            .patch({
              status:
                Object.keys(cosmos.gov.v1.ProposalStatus).find(
                  (key) =>
                    cosmos.gov.v1.ProposalStatus[key] ===
                    onchainPro?.proposal?.status
                ) || '',
              total_deposit: onchainPro?.proposal?.totalDeposit || [],
              tally: {
                yes: onchainPro.proposal?.finalTallyResult?.yesCount ?? '0',
                no: onchainPro.proposal?.finalTallyResult?.noCount ?? '0',
                abstain:
                  onchainPro.proposal?.finalTallyResult?.abstainCount ?? '0',
                no_with_veto:
                  onchainPro.proposal?.finalTallyResult?.noWithVetoCount ?? '0',
              },
            })
        );
      }
    });

    if (patchQueries.length > 0)
      await Promise.all(patchQueries).catch((error) => {
        this.logger.error(
          `Error update status for ended proposals: ${JSON.stringify(
            endedProposals
          )}`
        );
        this.logger.error(error);
      });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_NOT_ENOUGH_DEPOSIT_PROPOSAL,
    jobName: BULL_JOB_NAME.HANDLE_NOT_ENOUGH_DEPOSIT_PROPOSAL,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleNotEnoughDepositProposals(
    _payload: object
  ): Promise<void> {
    const batchQueries: any[] = [];
    const patchQueries: any[] = [];

    const current10SecsAgo = new Date(Date.now() - 10);

    const depositProposals = await Proposal.query()
      .where('status', Proposal.STATUS.PROPOSAL_STATUS_DEPOSIT_PERIOD)
      .andWhere('deposit_end_time', '<=', current10SecsAgo);

    depositProposals.forEach((proposal: Proposal) => {
      const request: QueryProposalRequest = {
        proposalId: Long.fromInt(proposal.proposal_id),
      };
      const data = toHex(
        cosmos.gov.v1.QueryProposalRequest.encode(request).finish()
      );

      batchQueries.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.PROPOSAL,
            data,
          })
        )
      );
    });

    const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
    const resultProposals: (QueryProposalResponse | null)[] = result.map(
      (res: JsonRpcSuccessResponse) =>
        res.result.response.value
          ? cosmos.gov.v1.QueryProposalResponse.decode(
              fromBase64(res.result.response.value)
            )
          : null
    );

    depositProposals.forEach((proposal: Proposal) => {
      const onchainPro = resultProposals.find((pro) =>
        pro?.proposal?.id.equals(Long.fromInt(proposal.proposal_id))
      );

      if (!onchainPro)
        patchQueries.push(
          Proposal.query().where('proposal_id', proposal.proposal_id).patch({
            status: Proposal.STATUS.PROPOSAL_STATUS_NOT_ENOUGH_DEPOSIT,
          })
        );
    });

    if (patchQueries.length > 0)
      await Promise.all(patchQueries).catch((error) => {
        this.logger.error(
          `Error update status for not enough deposit proposals: ${JSON.stringify(
            depositProposals
          )}`
        );
        this.logger.error(error);
      });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_PROPOSAL,
      BULL_JOB_NAME.CRAWL_PROPOSAL,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlProposal.crawlProposal.millisecondCrawl,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.HANDLE_ENDED_PROPOSAL,
      BULL_JOB_NAME.HANDLE_ENDED_PROPOSAL,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlProposal.handleEndedProposal.millisecondCrawl,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.HANDLE_NOT_ENOUGH_DEPOSIT_PROPOSAL,
      BULL_JOB_NAME.HANDLE_NOT_ENOUGH_DEPOSIT_PROPOSAL,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.crawlProposal.handleNotEnoughDepositProposal
              .millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}

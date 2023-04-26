/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  QueryProposalRequest,
  QueryProposalResponse,
} from '@aura-nw/aurajs/types/codegen/cosmos/gov/v1beta1/query';
import Long from 'long';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { cosmos } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
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
import {
  Account,
  Block,
  BlockCheckpoint,
  Proposal,
  Transaction,
  EventAttribute,
} from '../../models';

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
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleCrawlProposals(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listProposals: Proposal[] = [];

    const [crawlProposalBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_PROPOSAL),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (crawlProposalBlockCheckpoint) {
      lastHeight = crawlProposalBlockCheckpoint.height;
      updateBlockCheckpoint = crawlProposalBlockCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_PROPOSAL,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === lastHeight) return;

      const proposalIds: number[] = [];
      let page = 0;
      let done = false;
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .joinRelated('events.[attributes]')
          .where('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .andWhere('transaction.code', 0)
          .andWhere(
            'events:attributes.key',
            EventAttribute.EVENT_KEY.PROPOSAL_ID
          )
          .select(
            'transaction.id',
            'transaction.height',
            'events:attributes.key',
            'events:attributes.value'
          )
          .page(page, 100);
        this.logger.info(
          `Result get Tx from height ${lastHeight} to ${latestBlock.height}:`
        );
        this.logger.info(JSON.stringify(resultTx));

        if (resultTx.results.length > 0)
          resultTx.results.map((res: any) =>
            proposalIds.push(Number.parseInt(res.value, 10))
          );

        if (resultTx.results.length === 100) page += 1;
        else done = true;
      }

      if (proposalIds.length > 0) {
        const listProposalsInDb: Proposal[] = await Proposal.query().whereIn(
          'proposal_id',
          proposalIds
        );

        await Promise.all(
          proposalIds.map(async (proposalId: number) => {
            const proposal =
              await this._lcdClient.auranw.cosmos.gov.v1beta1.proposal({
                proposalId,
              });

            this.logger.info(
              `Proposal ${proposalId} content: ${JSON.stringify(
                proposal.proposal.content
              )}`
            );

            const foundProposal: Proposal | undefined = listProposalsInDb.find(
              (pro: Proposal) => pro.proposal_id === proposalId
            );

            let proposalEntity: Proposal;
            if (!foundProposal) {
              const [proposerId, initialDeposit] =
                await this.getProposerBySearchTx(proposalId);

              proposalEntity = Proposal.fromJson({
                proposal_id: proposalId,
                proposer_id: proposerId,
                voting_start_time: proposal.proposal.voting_start_time,
                voting_end_time: proposal.proposal.voting_end_time,
                submit_time: proposal.proposal.submit_time,
                deposit_end_time: proposal.proposal.deposit_end_time,
                type: proposal.proposal.content['@type'],
                title: proposal.proposal.content.title ?? '',
                description: proposal.proposal.content.description ?? '',
                content: proposal.proposal.content,
                status: proposal.proposal.status,
                tally: {
                  yes: '0',
                  no: '0',
                  abstain: '0',
                  no_with_veto: '0',
                },
                initial_deposit: initialDeposit,
                total_deposit: proposal.proposal.total_deposit,
                turnout: 0,
              });
            } else {
              proposalEntity = foundProposal;
              proposalEntity.status = proposal.proposal.status;
              proposalEntity.total_deposit = proposal.proposal.total_deposit;
            }

            listProposals.push(proposalEntity);
          })
        );

        await Proposal.query()
          .insert(listProposals)
          .onConflict('proposal_id')
          .merge()
          .returning('proposal_id')
          .catch((error) => {
            this.logger.error('Error insert or update proposals');
            this.logger.error(error);
          });
      }

      updateBlockCheckpoint.height = latestBlock.height;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
    }
  }

  private async getProposerBySearchTx(proposalId: number) {
    const tx = await Transaction.query()
      .joinRelated('events.[attributes]')
      .where('transaction.code', 0)
      .andWhere('events.type', EventAttribute.EVENT_KEY.SUBMIT_PROPOSAL)
      .andWhere('events:attributes.key', EventAttribute.EVENT_KEY.PROPOSAL_ID)
      .andWhere('events:attributes.value', proposalId.toString())
      .select('transaction.data')
      .limit(1)
      .offset(0);

    const msgIndex = tx[0].data.tx_response.logs.find(
      (log: any) =>
        log.events
          .find(
            (event: any) =>
              event.type === EventAttribute.EVENT_KEY.SUBMIT_PROPOSAL
          )
          .attributes.find(
            (attr: any) => attr.key === EventAttribute.EVENT_KEY.PROPOSAL_ID
          ).value === proposalId.toString()
    ).msg_index;

    const initialDeposit =
      tx[0].data.tx.body.messages[msgIndex].initial_deposit;
    const proposerAddress = tx[0].data.tx.body.messages[msgIndex].proposer;
    const proposerId = (
      await Account.query().findOne('address', proposerAddress)
    )?.id;

    return [proposerId, initialDeposit];
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_NOT_ENOUGH_DEPOSIT_PROPOSAL,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleNotEnoughDepositProposals(
    _payload: object
  ): Promise<void> {
    const batchQueries: any[] = [];

    const now = new Date(new Date().getSeconds() - 10);

    const depositProposals = await Proposal.query()
      // .patch({
      //   status: Proposal.STATUS.PROPOSAL_STATUS_NOT_ENOUGH_DEPOSIT,
      // })
      .where('status', Proposal.STATUS.PROPOSAL_STATUS_DEPOSIT_PERIOD)
      .andWhere('deposit_end_time', '<=', now);

    depositProposals.forEach((proposal: Proposal) => {
      const request: QueryProposalRequest = {
        proposalId: Long.fromInt(proposal.proposal_id),
      };
      const data = toHex(
        cosmos.gov.v1beta1.QueryProposalRequest.encode(request).finish()
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
          ? cosmos.gov.v1beta1.QueryProposalResponse.decode(
              fromBase64(res.result.response.value)
            )
          : null
    );

    depositProposals.forEach((proposal: Proposal) => {
      const onchainPro = resultProposals.find(
        (pro) =>
          pro?.proposal?.proposalId === Long.fromInt(proposal.proposal_id)
      );

      if (!onchainPro)
        // eslint-disable-next-line no-param-reassign
        proposal.status = Proposal.STATUS.PROPOSAL_STATUS_NOT_ENOUGH_DEPOSIT;
    });

    await Proposal.query()
      .insert(depositProposals)
      .onConflict('proposal_id')
      .merge()
      .returning('proposal_id')
      .catch((error) => {
        this.logger.error(
          'Error update status for not enough deposit proposals'
        );
        this.logger.error(error);
      });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_PROPOSAL,
      'crawl',
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
      BULL_JOB_NAME.HANDLE_NOT_ENOUGH_DEPOSIT_PROPOSAL,
      'crawl',
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

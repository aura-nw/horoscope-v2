/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  Account,
  Block,
  BlockCheckpoint,
  Proposal,
  Transaction,
  TransactionEventAttribute,
} from 'src/models';
import {
  BULL_JOB_NAME,
  Config,
  getLcdClient,
  IAuraJSClientFactory,
  PROPOSAL_STATUS,
  SERVICE,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';

@Service({
  name: SERVICE.V1.CrawlProposalService.key,
  version: 1,
})
export default class CrawlProposalService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_PROPOSAL,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleCrawlProposals(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listBulk: any[] = [];

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
      let offset = 0;
      let done = false;
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .select('transaction.id', 'transaction.height')
          .join(
            'transaction_event',
            'transaction.id',
            'transaction_event.tx_id'
          )
          .select('transaction_event.tx_id')
          .join(
            'transaction_event_attribute',
            'transaction_event.id',
            'transaction_event_attribute.event_id'
          )
          .select(
            'transaction_event_attribute.key',
            'transaction_event_attribute.value'
          )
          .where('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .andWhere('transaction.code', '=', '0')
          .andWhere(
            'transaction_event_attribute.key',
            '=',
            TransactionEventAttribute.EVENT_KEY.PROPOSAL_ID
          )
          .limit(100)
          .offset(offset);
        this.logger.info(
          `Result get Tx from height ${lastHeight} to ${latestBlock.height}:`
        );
        this.logger.info(JSON.stringify(resultTx));

        if (resultTx.length > 0)
          resultTx.map((res: any) =>
            proposalIds.push(Number.parseInt(res.value, 10))
          );

        if (resultTx.length === 100) offset += 1;
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

            listBulk.push(
              Proposal.query()
                .insert(proposalEntity)
                .onConflict('proposal_id')
                .merge()
                .returning('proposal_id')
            );

            if (
              proposal.status === PROPOSAL_STATUS.PROPOSAL_STATUS_VOTING_PERIOD
            ) {
              this.broker.call(
                SERVICE.V1.CrawlTallyProposalService.UpdateProposalTally.path,
                { proposalId }
              );
            }
          })
        );

        try {
          await Promise.all(listBulk);
        } catch (error) {
          this.logger.error(error);
        }
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
    const tx: any = await Transaction.query()
      .select('transaction.data')
      .join('transaction_event', 'transaction.id', 'transaction_event.tx_id')
      .join(
        'transaction_event_attribute',
        'transaction_event.id',
        'transaction_event_attribute.event_id'
      )
      .where('transaction.code', '=', '0')
      .andWhere(
        'transaction_event.type',
        '=',
        TransactionEventAttribute.EVENT_KEY.SUBMIT_PROPOSAL
      )
      .andWhere(
        'transaction_event_attribute.key',
        '=',
        TransactionEventAttribute.EVENT_KEY.PROPOSAL_ID
      )
      .andWhere('transaction_event_attribute.value', '=', `${proposalId}`)
      .limit(1)
      .offset(0);

    const msgIndex = tx[0].data.tx_response.logs.find(
      (log: any) =>
        log.events
          .find(
            (event: any) =>
              event.type === TransactionEventAttribute.EVENT_KEY.SUBMIT_PROPOSAL
          )
          .attributes.find(
            (attr: any) =>
              attr.key === TransactionEventAttribute.EVENT_KEY.PROPOSAL_ID
          ).value === proposalId
    ).msg_index;

    const initialDeposit =
      tx[0].data.tx.body.messages[msgIndex].initial_deposit;
    const proposerAddress = tx[0].data.tx.body.messages[msgIndex].proposer;
    const proposerId = (
      await Account.query().findOne('address', proposerAddress)
    )?.id;

    return [proposerId, initialDeposit];
  }

  public async _start() {
    await this.broker.waitForServices([
      SERVICE.V1.CrawlTallyProposalService.name,
    ]);

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
          every: parseInt(Config.MILISECOND_CRAWL_PROPOSAL, 10),
        },
      }
    );

    return super._start();
  }
}

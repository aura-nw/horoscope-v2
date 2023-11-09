import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { BlockCheckpoint, TransactionMessage, Vote } from '../../models';
import { BULL_JOB_NAME, MSG_TYPE, SERVICE } from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.HandleVoteTx.key,
  version: 1,
})
export default class HandleTxVoteService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_VOTE_TX,
    jobName: BULL_JOB_NAME.HANDLE_VOTE_TX,
  })
  private async jobHandle(_payload: any): Promise<void> {
    await this.handleVote();
  }

  async handleVote() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_VOTE_TX,
        [BULL_JOB_NAME.HANDLE_AUTHZ_TX],
        config.handleVoteTx.key
      );
    this.logger.info(
      `Handle Voting message from block ${startBlock} to block ${endBlock}`
    );
    if (startBlock > endBlock) {
      return;
    }
    const txMsgs = await TransactionMessage.query()
      .select('transaction.hash', 'transaction.height', 'transaction_message.*')
      .joinRelated('transaction')
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock)
      .andWhere((builder) => {
        builder.whereIn('type', [MSG_TYPE.MSG_VOTE, MSG_TYPE.MSG_VOTE_V1]);
      })
      .andWhere('code', 0)
      .orderBy([
        { column: 'height', order: 'ASC' },
        { column: 'transaction_message.index', order: 'ASC' },
      ]);
    const votesInsert: Vote[] = [];
    txMsgs.forEach((txMsg) => {
      const { content } = txMsg;
      votesInsert.push(
        Vote.fromJson({
          voter: content.voter,
          txhash: txMsg.hash,
          proposal_id: content.proposal_id,
          vote_option: content.option,
          height: txMsg.height,
          tx_id: txMsg.tx_id,
        })
      );
    });

    await knex.transaction(async (trx) => {
      votesInsert.forEach(async (vote) => {
        const resultInsert = await Vote.query(trx)
          .insert(vote)
          .onConflict(['proposal_id', 'voter'])
          .merge(['vote_option', 'height', 'tx_id', 'txhash'])
          .where('vote.height', '<=', vote.height)
          .transacting(trx);
        this.logger.debug('result insert vote: ', resultInsert);
      });
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;

        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      }
    });
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.HANDLE_VOTE_TX,
      BULL_JOB_NAME.HANDLE_VOTE_TX,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleVoteTx.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

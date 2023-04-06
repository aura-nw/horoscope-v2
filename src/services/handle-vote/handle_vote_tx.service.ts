import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { raw } from 'objection';
import { Checkpoint, Transaction } from '../../models';
import { BULL_JOB_NAME, SERVICE_NAME } from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE_NAME.HANDLE_VOTE_TX,
  version: 1,
})
export default class HandleTxVote extends BullableService {
  private _currentTxId = 0;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_VOTE_TX,
    jobType: BULL_JOB_NAME.HANDLE_VOTE_TX,
  })
  private async jobHandle(_payload: any): Promise<void> {
    await this.initEnv();
    await this.handleTx();
  }

  async initEnv() {
    const checkpoint = (
      await Checkpoint.query().findOne({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
      })
    )?.data.tx_id;
    if (checkpoint == null) {
      await Checkpoint.query().insert({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        data: {
          tx_id: config.handleVoteTx.startTxId,
        },
      });
    }
    this._currentTxId = checkpoint ?? 0;
  }

  async handleTx() {
    const sql = Transaction.query()
      .joinRelated('events.[attributes]')
      // .withGraphFetched(TransactionEventAttribute)
      // .where('transaction.id', '>=', this._currentTxId)
      .where('events.type', 'proposal_vote')
      .orderBy('transaction.id')
      .limit(config.handleVoteTx.numberOfTxPerCall)
      .toKnexQuery()
      .toSQL()
      .toNative();
    this.logger.info(sql);
    const listTx = await Transaction.query()
      .joinRelated('events.[attributes]')
      // .withGraphFetched(TransactionEventAttribute)
      .where('transaction.id', '>=', this._currentTxId)
      .andWhere('events.type', 'proposal_vote')
      .orderBy('transaction.id')
      .limit(config.handleVoteTx.numberOfTxPerCall)
      .groupBy('transaction.id')
      .select(
        'transaction.hash',
        'transaction.id',
        raw(
          'json_object_agg("events:attributes".key, "events:attributes".value) as '
        )
      );
    this.logger.info(listTx.length);
    // this.logger.info(JSON.stringify(listTx));
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

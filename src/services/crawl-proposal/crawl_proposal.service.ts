/* eslint-disable import/no-extraneous-dependencies */
// import { fromBase64, toBech32 } from '@cosmjs/encoding';
// import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import {
  //   Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { Config } from '../../common';
// import { getLcdClient } from '../../common/utils/aurajs_client';
import BullableService, { QueueHandler } from '../../base/bullable.service';
// import { Config } from '../../common';
import {
  BULL_JOB_NAME,
  CONST_CHAR,
  //   BULL_ACTION_NAME,
  //   BULL_JOB_NAME,
  // MODULE_PARAM,
  SERVICE_NAME,
  // URL_TYPE_CONSTANTS,
} from '../../common/constant';
import { getLcdClient } from '../../common/utils/aurajs_client';
import BlockCheckpoint from '../../models/block_checkpoint';
import Block from '../../models/block';
import Transaction from '../../models/transaction';

@Service({
  name: SERVICE_NAME.CRAWL_PROPOSAL,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class CrawlProposalService extends BullableService {
  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_PROPOSAL,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleCrawlAllValidator(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    // const listBulk: any[] = [];
    // const listValidator: any[] = [];

    const [handleAddressBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('height')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_VALIDATOR),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let lastHeight = 0;
    if (handleAddressBlockCheckpoint)
      lastHeight = handleAddressBlockCheckpoint.height;

    if (latestBlock) {
      const resultTx = await Transaction.query()
        .select('transaction.id', 'transaction.height')
        .join('transaction_event', 'transaction.id', 'transaction_event.tx_id')
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
        .andWhere('transaction.code', '!=', '0')
        .andWhere((builder) =>
          builder.whereIn('transaction_event_attribute.key', [
            CONST_CHAR.VALIDATOR,
            CONST_CHAR.SOURCE_VALIDATOR,
            CONST_CHAR.DESTINATION_VALIDATOR,
          ])
        )
        .limit(1)
        .offset(0);
      this.logger.info(
        `Result get Tx from height ${lastHeight} to ${latestBlock.height}:`
      );
      this.logger.info(JSON.stringify(resultTx));
    }
  }
}

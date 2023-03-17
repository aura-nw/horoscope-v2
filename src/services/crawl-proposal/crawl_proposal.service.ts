/* eslint-disable import/no-extraneous-dependencies */
// import { fromBase64, toBech32 } from '@cosmjs/encoding';
// import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import {
  //   Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
// import { getLcdClient } from '../../common/utils/aurajs_client';
import BullableService from '../../base/bullable.service';
// import { Config } from '../../common';
import {
  CONST_CHAR,
  //   BULL_ACTION_NAME,
  //   BULL_JOB_NAME,
  // MODULE_PARAM,
  SERVICE_NAME,
  // URL_TYPE_CONSTANTS,
} from '../../common/constant';

@Service({
  name: SERVICE_NAME.CRAWL_PROPOSAL,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class CrawlProposalService extends BullableService {
  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }
}

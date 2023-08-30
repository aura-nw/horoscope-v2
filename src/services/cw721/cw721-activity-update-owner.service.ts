import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import { BULL_JOB_NAME, SERVICE } from '../../common/constant';
import CW721Activity from '../../models/cw721_tx';
import { CW721_ACTION } from './cw721.service';

const { NODE_ENV } = Config;

@Service({
  name: SERVICE.V1.Cw721ActivityUpdateOwnerService.key,
  version: 1,
})
export default class Cw721ActivityUpdateOwnerService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER_BY_TOKEN,
    jobName: BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER_BY_TOKEN,
  })
  async updateCw721ActOwnerByToken(_payload: {
    cw721ContractId: number;
    cw721TokenId: number;
  }): Promise<void> {
    const { cw721ContractId, cw721TokenId } = _payload;
    const activities = await CW721Activity.query()
      .whereIn('action', [
        CW721_ACTION.TRANSFER,
        CW721_ACTION.SEND_NFT,
        CW721_ACTION.BURN,
      ])
      .whereNull('owner')
      .andWhere('cw721_token_id', cw721TokenId)
      .andWhere('cw721_contract_id', cw721ContractId)
      .orderBy('id')
      .limit(100);
    const lastOwnerActivity = await CW721Activity.query()
      .whereIn('action', [CW721_ACTION.MINT, CW721_ACTION.TRANSFER])
      .andWhere('cw721_token_id', cw721TokenId)
      .andWhere('cw721_contract_id', cw721ContractId)
      .whereNotNull('owner')
      .orderBy('height', 'DESC')
      .first()
      .throwIfNotFound();
    const sortedActivities = _.sortBy(
      [...activities, lastOwnerActivity],
      (e) => e.height
    );
    for (let index = 1; index < sortedActivities.length; index += 1) {
      sortedActivities[index].owner = sortedActivities[index - 1].to;
    }
    await CW721Activity.query()
      .insert(sortedActivities)
      .onConflict('id')
      .merge();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER,
    jobName: BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER,
  })
  async jobHandler(): Promise<void> {
    const unprocessedActivities = await CW721Activity.query()
      .whereIn('action', [
        CW721_ACTION.MINT,
        CW721_ACTION.TRANSFER,
        CW721_ACTION.SEND_NFT,
        CW721_ACTION.BURN,
      ])
      .whereNull('owner')
      .orderBy('id')
      .limit(100);
    await this.updateOwnerForMintActs(
      unprocessedActivities.filter((e) => e.action === CW721_ACTION.MINT)
    );
    const tokens = unprocessedActivities.reduce(
      (acc: { cw721ContractId: number; cw721TokenId: number }[], curr) => {
        if (
          acc.find(
            (e) =>
              e.cw721ContractId === curr.cw721_contract_id &&
              e.cw721TokenId === curr.cw721_token_id
          ) === undefined
        ) {
          acc.push({
            cw721ContractId: curr.cw721_contract_id,
            cw721TokenId: curr.cw721_token_id,
          });
        }
        return acc;
      },
      []
    );
    await Promise.all(
      tokens.map(async (token) =>
        this.createJob(
          BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER_BY_TOKEN,
          BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER_BY_TOKEN,
          token,
          {
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        )
      )
    );
  }

  async updateOwnerForMintActs(activities: CW721Activity[]) {
    const patchQueries = activities.map((act) =>
      CW721Activity.query()
        .patch({
          owner: act.to,
        })
        .where('id', act.id)
    );
    if (patchQueries.length > 0) {
      await Promise.all(patchQueries);
    }
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER,
        BULL_JOB_NAME.UPDATE_CW721_ACTIVITY_OWNER,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.cw721.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }
}

import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import Feegrant from 'src/models/feegrant';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, Config, SERVICE } from '../../common';
import FeegrantHistory from '../../models/feegrant_history';
import { FEEGRANT_ACTION } from './feegrant.service';

const { NODE_ENV } = Config;

export const FEEGRANT_STATUS = {
  AVAILABLE: 'Available',
  USE_UP: 'Use up',
  REVOKED: 'Revoked',
  FAIL: 'Fail',
};

interface IUpdateFeegrant {
  amount: string;
  status: string;
}

@Service({
  name: SERVICE.V1.Feegrant.UpdateFeegrantService.key,
  version: 1,
})
export default class UpdateFeegrantService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.UPDATE_FEEGRANT,
    jobName: BULL_JOB_NAME.UPDATE_FEEGRANT,
  })
  async jobHandler(): Promise<void> {
    const listUnprocess = await FeegrantHistory.query()
      .where({
        feegrant_id: null,
        // result: true ??? need check
      })
      .limit(config.feegrant.updateFeegrant.limitPerBatch);
    if (listUnprocess.length > 0) {
      const listOriginalFeegrant = await Feegrant.query()
        .whereIn(
          ['granter', 'granter'],
          listUnprocess.map((item) => [item.granter, item.grantee])
        )
        .andWhere({
          status: FEEGRANT_STATUS.AVAILABLE,
          // result: true ??? need check
        });
      // List to update feegrant DB
      const feegrantHistories: FeegrantHistory[] = [];
      const queriesUpdateOriginal: any[] = [];
      listUnprocess.forEach((e) => {
        // E 's original feegrant
        // Each unprocessed action: find original by looking up feegrant which has timestamp is max of all less than or equal its timestamp
        const suspiciousFeegrants = listOriginalFeegrant.filter(
          (x) =>
            x.grantee === e.grantee &&
            x.granter === e.granter &&
            x.init_tx_id < e.tx_id
        );
        if (suspiciousFeegrants.length > 0) {
          const originalFeegrant = suspiciousFeegrants.reduce((prev, current) =>
            prev.init_tx_id > current.init_tx_id ? prev : current
          );
          e.feegrant_id = originalFeegrant.init_tx_id;
          feegrantHistories.push(e);
          queriesUpdateOriginal.push(
            FeegrantHistory.query().where({ id: e.id }).patch({
              feegrant_id: originalFeegrant.id,
            })
          );
        }
      });
      await Promise.all(queriesUpdateOriginal);
      await this.updateFeegrant(feegrantHistories);
    }
  }

  async updateFeegrant(feegrantHistories: FeegrantHistory[]) {
    // Process unprocess actions: use, revoke, use up
    const mapUpdate = new Map<number | null, IUpdateFeegrant>();
    // List Revoke
    const listRevoke = [] as FeegrantHistory[];
    if (feegrantHistories.length > 0) {
      // Initialize map
      feegrantHistories.forEach((e) => {
        if (
          e.action === FEEGRANT_ACTION.USE ||
          e.action === FEEGRANT_ACTION.REVOKE
        ) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          mapUpdate.set(e.feegrant_id, {
            amount: 0,
            status: FEEGRANT_STATUS.AVAILABLE,
          });
        }
      });
      // Update map
      feegrantHistories.forEach((e) => {
        const currentUpdate = mapUpdate.get(e.feegrant_id ?? null);
        // For each new used record received, update spendable
        if (currentUpdate) {
          if (e.action === FEEGRANT_ACTION.USE) {
            if (e.amount) {
              const tmpAmount = (
                BigInt(currentUpdate.amount) + BigInt(e.amount)
              ).toString();
              const tmpStatus = currentUpdate.status;
              mapUpdate.set(e.feegrant_id ?? null, {
                amount: tmpAmount,
                status: tmpStatus,
              });
            } else {
              throw new Error('Use feegrant but not found fee');
            }
          } else if (e.action === FEEGRANT_ACTION.REVOKE) {
            if (e.status === FEEGRANT_STATUS.USE_UP) {
              // For each new used up record received, update status to use up
              const tmpAmount = currentUpdate.amount;
              const tmpStatus = FEEGRANT_STATUS.USE_UP;

              mapUpdate.set(e.feegrant_id ?? null, {
                amount: tmpAmount,
                status: tmpStatus,
              });
            } else {
              // For each new revoked record received, update status to revoked
              const tmpAmount = currentUpdate.amount;
              const tmpStatus = FEEGRANT_STATUS.REVOKED;
              listRevoke.push(e);
              mapUpdate.set(e.feegrant_id ?? null, {
                amount: tmpAmount,
                status: tmpStatus,
              });
            }
          }
        } else {
          throw new Error(`${e.feegrant_id} not found in mapUpdate`);
        }
      });
      const queriesUpdate = [] as any[];
      const originalFeegrants = await Feegrant.query().whereIn(
        'init_tx_id',
        Array.from(mapUpdate.keys())
      );
      originalFeegrants.forEach((e) => {
        if (e.spend_limit) {
          this.logger.info(e.spend_limit);
          queriesUpdate.push(
            Feegrant.query()
              .where('id', e.id)
              .patch({
                amount: e.spend_limit
                  ? (
                      BigInt(e.spend_limit) -
                      BigInt(mapUpdate?.get(e.tx_hash.toString())?.amount ?? 0)
                    ).toString()
                  : null,
                status: mapUpdate.get(e.id)?.status,
              })
          );
        } else {
          queriesUpdate.push(
            Feegrant.query()
              .where('id', e.id)
              .patch({
                status: mapUpdate.get(e.id)?.status,
              })
          );
        }
      });
      await Promise.all(queriesUpdate);
      const bulkUpdateOriginRevoke = [] as any[];
      listRevoke.forEach((e) => {
        bulkUpdateOriginRevoke.push(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          Feegrant.query().where('id', e.feegrant_id)
        );
      });
      /* eslint-enable camelcase */
      await Promise.all(bulkUpdateOriginRevoke);
    }
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.UPDATE_FEEGRANT,
        BULL_JOB_NAME.UPDATE_FEEGRANT,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.feegrant.updateFeegrant.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }
}

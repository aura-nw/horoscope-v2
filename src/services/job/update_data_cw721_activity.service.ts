import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { getAttributeFrom } from '../../common/utils/smart_contract';
import CW721Activity from '../../models/cw721_tx';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { EventAttribute } from '../../models';

const UPDATE_CW721_ACTIONS = ['mint', 'burn', 'transfer_nft', 'send_nft'];
@Service({
  name: SERVICE.V1.JobService.UpdateDataCw721Activity.key,
  version: 1,
})
export default class JobUpdateDataCw721Activity extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_UPDATE_DATA_CW721_ACTIVITY,
    jobName: BULL_JOB_NAME.JOB_UPDATE_DATA_CW721_ACTIVITY,
  })
  async updateDataCw721Activity(_payload: { prevId: number }) {
    const { prevId } = _payload;

    const handleRecords = await CW721Activity.query()
      .withGraphFetched('smart_contract_event.attributes')
      .where('cw721_activity.from', null)
      .andWhere('cw721_activity.to', null)
      .andWhere('cw721_activity.id', '>', prevId)
      .whereIn('cw721_activity.action', UPDATE_CW721_ACTIONS)
      .whereNotNull('smart_contract_event_id')
      .orderBy('cw721_activity.id')
      .limit(config.jobUpdateDataCw721Activity.limitRecordGet);

    if (handleRecords.length > 0) {
      const patchQueries: any[] = [];
      handleRecords.forEach((record) => {
        patchQueries.push(
          CW721Activity.query()
            .patch({
              from: getAttributeFrom(
                record.smart_contract_event.attributes,
                EventAttribute.ATTRIBUTE_KEY.SENDER
              ),
              to:
                getAttributeFrom(
                  record.smart_contract_event.attributes,
                  EventAttribute.ATTRIBUTE_KEY.OWNER
                ) ||
                getAttributeFrom(
                  record.smart_contract_event.attributes,
                  EventAttribute.ATTRIBUTE_KEY.RECIPIENT
                ),
            })
            .where('id', record.id)
        );
      });
      await Promise.all(patchQueries);
      await this.createJob(
        BULL_JOB_NAME.JOB_UPDATE_DATA_CW721_ACTIVITY,
        BULL_JOB_NAME.JOB_UPDATE_DATA_CW721_ACTIVITY,
        {
          prevId: handleRecords[handleRecords.length - 1].id,
        },
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          attempts: config.jobRetryAttempt,
          backoff: config.jobRetryBackoff,
        }
      );
    }
  }

  async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.JOB_UPDATE_DATA_CW721_ACTIVITY,
      BULL_JOB_NAME.JOB_UPDATE_DATA_CW721_ACTIVITY,
      {
        prevId: 0,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );
    return super._start();
  }
}

import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };
import CW721Activity from '../src/models/cw721_tx';
import { getAttributeFrom } from '../src/common/utils/smart_contract';
import { EventAttribute } from '../src/models';
const UPDATE_CW721_ACTIONS = ['mint', 'burn', 'transfer_nft', 'send_nft'];
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    let prevId = 0;
    while (true) {
      const handleRecords = await CW721Activity.query()
        .withGraphFetched('smart_contract_event.attributes')
        .where('cw721_activity.from', null)
        .andWhere('cw721_activity.to', null)
        .andWhere('cw721_activity.id', '>', prevId)
        .whereIn('cw721_activity.action', UPDATE_CW721_ACTIONS)
        .whereNotNull('smart_contract_event_id')
        .orderBy('cw721_activity.id')
        .limit(config.jobUpdateDataCw721Activity.limitRecordGet)
        .transacting(trx);

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
              .transacting(trx)
          );
        });
        await Promise.all(patchQueries);
        prevId = handleRecords[handleRecords.length - 1].id;
      } else {
        break;
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {}

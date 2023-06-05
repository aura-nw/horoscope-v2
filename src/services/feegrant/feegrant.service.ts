import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { getAttributeFrom } from 'src/common/utils/smart_contract';
import { Event, EventAttribute } from 'src/models';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, Config, SERVICE } from '../../common';

const { NODE_ENV } = Config;

export const FEEGRANT_ACTION = {
  CREATE: 'create',
  REVOKE: 'revoke',
  USE: 'use',
  USE_UP: 'useup',
};

interface IFeegrantEvent {
  tx_id: number;
  feegrant_id?: number;
  action: string;
  amount?: string;
  granter: string;
  grantee: string;
  denom?: string;
}

// interface IFeegrantCreateEvent extends IFeegrantEvent {
//   type: string;
//   spend_limit?: string;
//   denom?: string;
//   expiration?: Date;
//   status: string;
// }

@Service({
  name: SERVICE.V1.Feegrant.HandleFeegrantHistoryService.key,
  version: 1,
})
export default class HandleFeegrantHistoryService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_FEEGRANT,
    jobName: BULL_JOB_NAME.HANDLE_FEEGRANT,
  })
  async jobHandler(): Promise<void> {
    // get range blocks for proccessing
    // const [startBlock, endBlock, updateBlockCheckpoint] =
    //   await BlockCheckpoint.getCheckpoint(
    //     BULL_JOB_NAME.HANDLE_FEEGRANT,
    //     [BULL_JOB_NAME.CRAWL_TRANSACTION],
    //     config.feegrant.key
    //   );
    // this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    // if (startBlock >= endBlock) return;
    // const feegrantEvents = await this.getFeegrantEvents(startBlock, endBlock);
    // await knex.transaction(async (trx) => {
    //   const createEvents = feegrantEvents.filter(
    //     (event) => event.action === FEEGRANT_ACTION.CREATE
    //   );
    //   const newFeegrant = createEvents.map((createEvent) =>
    //     Feegrant.fromJson({
    //       init_tx_id: createEvent.tx_id,
    //       granter: createEvent.granter,
    //       grantee: createEvent.grantee,
    //     })
    //   );
    // });
  }

  async getFeegrantEvents(startBlock: number, endBlock: number) {
    const formatedFeegrantEvents: IFeegrantEvent[] = [];
    const feegrantEvents = await Event.query()
      .alias('event')
      .withGraphJoined(
        '[attributes(selectAttribute),transaction(selectTransaction),message(selectMessage)]'
      )
      .modifiers({
        selectAttribute(builder) {
          builder.select('key', 'value');
        },
        selectTransaction(builder) {
          builder.select('fee', 'id');
        },
        selectMessage(builder) {
          builder.select('content');
        },
      })
      .whereIn('type', [
        Event.EVENT_TYPE.USE_FEEGRANT,
        Event.EVENT_TYPE.SET_FEEGRANT,
        Event.EVENT_TYPE.REVOKE_FEEGRANT,
      ])
      .andWhere('transaction.height', '>', startBlock)
      .andWhere('transaction.height', '<=', endBlock);

    feegrantEvents.forEach((feegrantEvent) => {
      if (feegrantEvent.type === Event.EVENT_TYPE.USE_FEEGRANT) {
        if (feegrantEvent.transaction.fee) {
          const fees = JSON.parse(feegrantEvent.transaction.fee);
          fees.forEach((fee: { amount: string; denom: string }) => {
            formatedFeegrantEvents.push({
              tx_id: feegrantEvent.transaction.id,
              action: FEEGRANT_ACTION.USE,
              amount: fee.amount,
              granter: getAttributeFrom(
                feegrantEvent.attributes,
                EventAttribute.ATTRIBUTE_KEY.GRANTER
              ),
              grantee: getAttributeFrom(
                feegrantEvent.attributes,
                EventAttribute.ATTRIBUTE_KEY.GRANTEE
              ),
              denom: fee.denom,
            });
          });
        } else {
          throw new Error(
            `Transaction ${feegrantEvent.transaction.id} not found fee`
          );
        }
      } else if (feegrantEvent.type === Event.EVENT_TYPE.SET_FEEGRANT) {
        // const message = JSON.parse(feegrantEvent.message.content);
        // let basic_allowance = message.allowance;
        // 			while (
        // 				basic_allowance['@type'] !== ALLOWANCE_TYPE.BASIC_ALLOWANCE &&
        // 				basic_allowance['@type'] !== ALLOWANCE_TYPE.PERIODIC_ALLOWANCE
        // 			) {
        // 				basic_allowance = basic_allowance.allowance;
        // 			}
        // 			const type = basic_allowance['@type'];
        // 			if (basic_allowance['@type'] === ALLOWANCE_TYPE.PERIODIC_ALLOWANCE) {
        // 				basic_allowance = basic_allowance.basic;
        // 			}
        // 			if (basic_allowance.spend_limit.length > 0) {
        // 				spend_limit = basic_allowance.spend_limit[0] as Coin;
        // 			}
        formatedFeegrantEvents.push({
          tx_id: feegrantEvent.transaction.id,
          action: FEEGRANT_ACTION.CREATE,
          granter: getAttributeFrom(
            feegrantEvent.attributes,
            EventAttribute.ATTRIBUTE_KEY.GRANTER
          ),
          grantee: getAttributeFrom(
            feegrantEvent.attributes,
            EventAttribute.ATTRIBUTE_KEY.GRANTEE
          ),
        });
      } else if (feegrantEvent.type === Event.EVENT_TYPE.REVOKE_FEEGRANT) {
        if (feegrantEvent.tx_msg_index) {
          formatedFeegrantEvents.push({
            tx_id: feegrantEvent.transaction.id,
            action: FEEGRANT_ACTION.REVOKE,
            granter: getAttributeFrom(
              feegrantEvent.attributes,
              EventAttribute.ATTRIBUTE_KEY.GRANTER
            ),
            grantee: getAttributeFrom(
              feegrantEvent.attributes,
              EventAttribute.ATTRIBUTE_KEY.GRANTEE
            ),
          });
        } else {
          formatedFeegrantEvents.push({
            tx_id: feegrantEvent.transaction.id,
            action: FEEGRANT_ACTION.USE_UP,
            granter: getAttributeFrom(
              feegrantEvent.attributes,
              EventAttribute.ATTRIBUTE_KEY.GRANTER
            ),
            grantee: getAttributeFrom(
              feegrantEvent.attributes,
              EventAttribute.ATTRIBUTE_KEY.GRANTEE
            ),
          });
        }
      } else {
        throw new Error('getFeegrantEvents error');
      }
    });
    return formatedFeegrantEvents;
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.HANDLE_FEEGRANT,
        BULL_JOB_NAME.HANDLE_FEEGRANT,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.feegrant.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }
}

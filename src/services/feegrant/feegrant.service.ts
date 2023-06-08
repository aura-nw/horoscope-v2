import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import FeegrantHistory from '../../models/feegrant_history';
import { getAttributeFrom } from '../../common/utils/smart_contract';
import { BlockCheckpoint, Event, EventAttribute } from '../../models';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, Config, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import Feegrant from '../../models/feegrant';

const { NODE_ENV } = Config;

export const FEEGRANT_ACTION = {
  CREATE: 'create',
  REVOKE: 'revoke',
  USE: 'use',
  USE_UP: 'useup',
};

export const ALLOWANCE_TYPE = {
  BASIC_ALLOWANCE: '/cosmos.feegrant.v1beta1.BasicAllowance',
  PERIODIC_ALLOWANCE: '/cosmos.feegrant.v1beta1.PeriodicAllowance',
  ALLOWED_MSGS_ALLOWANCE: '/cosmos.feegrant.v1beta1.AllowedMsgAllowance',
  ALLOWED_CONTRACT_ALLOWANCE:
    '/cosmos.feegrant.v1beta1.AllowedContractAllowance',
};

export const FEEGRANT_STATUS = {
  AVAILABLE: 'Available',
  USE_UP: 'Use up',
  REVOKED: 'Revoked',
  FAIL: 'Fail',
};

interface IFeegrantEvent {
  tx_id: number;
  feegrant_id?: number;
  action: string;
  granter: string;
  grantee: string;
  amount?: string;
  denom?: string;
}

interface IFeegrantCreateEvent extends IFeegrantEvent {
  type: string;
  spend_limit?: string;
  denom?: string;
  expiration?: Date;
  status: string;
}

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
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_FEEGRANT,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.feegrant.key
      );
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    if (startBlock >= endBlock) return;
    const feegrantEvents: IFeegrantEvent[] = await this.getFeegrantEvents(
      startBlock,
      endBlock
    );
    await knex.transaction(async (trx) => {
      const createEvents: IFeegrantCreateEvent[] = feegrantEvents.filter(
        (event) => event.action === FEEGRANT_ACTION.CREATE
      ) as IFeegrantCreateEvent[];
      const newFeegrants = createEvents.map((createEvent) =>
        Feegrant.fromJson({
          init_tx_id: createEvent.tx_id,
          ..._.pick(createEvent, [
            'granter',
            'grantee',
            'type',
            'expiration',
            'status',
            'spend_limit',
            'denom',
          ]),
        })
      );
      if (newFeegrants.length > 0) {
        await Feegrant.query().insert(newFeegrants).transacting(trx);
      }
      const newHistories = feegrantEvents.map((feegrantEvent) =>
        FeegrantHistory.fromJson(
          _.pick(feegrantEvent, [
            'tx_id',
            'action',
            'amount',
            'granter',
            'grantee',
            'denom',
          ])
        )
      );
      if (newHistories.length > 0) {
        this.logger.info(
          feegrantEvents.map((feegrantEvent) => (
            _.pick(feegrantEvent, [
              'tx_id',
              'action',
              'amount',
              'granter',
              'grantee',
              'denom',
            ])
          ))
        );
        await FeegrantHistory.query().insert(newHistories).transacting(trx);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  async getFeegrantEvents(startBlock: number, endBlock: number) {
    const formatedFeegrantEvents: any[] = [];
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
          builder.select('fee', 'id', 'code', 'height');
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
          const fee: { amount: string; denom: string } =
            feegrantEvent.transaction.fee[0];
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
        } else {
          throw new Error(
            `Transaction ${feegrantEvent.transaction.id} not found fee`
          );
        }
      }
    });
    feegrantEvents.forEach((feegrantEvent) => {
      if (feegrantEvent.type === Event.EVENT_TYPE.SET_FEEGRANT) {
        if (feegrantEvent.message) {
          const message = feegrantEvent.message.content;
          // eslint-disable-next-line @typescript-eslint/naming-convention
          const { type, spend_limit, denom, expiration } =
            this.getCreateFeegrantInfo(message);
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
            type,
            amount: spend_limit,
            spend_limit,
            denom,
            expiration,
            status: FEEGRANT_STATUS.AVAILABLE,
          } satisfies IFeegrantCreateEvent);
        }
      } else if (feegrantEvent.type === Event.EVENT_TYPE.REVOKE_FEEGRANT) {
        if (feegrantEvent.tx_msg_index !== null) {
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
          const index = formatedFeegrantEvents.findIndex(
            (e: IFeegrantEvent) =>
              e.action === FEEGRANT_ACTION.USE &&
              e.tx_id === feegrantEvent.transaction.id &&
              e.granter ===
                getAttributeFrom(
                  feegrantEvent.attributes,
                  EventAttribute.ATTRIBUTE_KEY.GRANTER
                ) &&
              e.grantee ===
                getAttributeFrom(
                  feegrantEvent.attributes,
                  EventAttribute.ATTRIBUTE_KEY.GRANTEE
                )
          );
          formatedFeegrantEvents[index].action = FEEGRANT_ACTION.USE_UP;
        }
      }
    });
    return _.sortBy(formatedFeegrantEvents, ['tx_id']);
  }

  getCreateFeegrantInfo(message: any): {
    type: string;
    spend_limit: string | undefined;
    denom: string | undefined;
    expiration: Date | undefined;
  } {
    let spendLimit;
    let denom;
    let basicAllowance = message.allowance;
    let type = basicAllowance['@type'];
    while (
      type !== ALLOWANCE_TYPE.BASIC_ALLOWANCE &&
      type !== ALLOWANCE_TYPE.PERIODIC_ALLOWANCE
    ) {
      basicAllowance = basicAllowance.allowance;
      type = basicAllowance['@type'];
    }
    if (type === ALLOWANCE_TYPE.PERIODIC_ALLOWANCE) {
      basicAllowance = basicAllowance.basic;
    }
    if (basicAllowance.spend_limit && basicAllowance.spend_limit.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      spendLimit = basicAllowance.spend_limit[0].amount; // need upgrade
      denom = basicAllowance.spend_limit[0].denom;
    }
    if (!type) throw new Error('Cannot detect feegrant type');
    return {
      type,
      spend_limit: spendLimit,
      denom,
      expiration: basicAllowance.expiration
        ? new Date(basicAllowance.expiration)
        : undefined,
    };
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

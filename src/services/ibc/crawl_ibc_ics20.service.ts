import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import {
  BlockCheckpoint,
  EventAttribute,
  IbcIcs20,
  IbcMessage,
} from '../../models';

@Service({
  name: SERVICE.V1.CrawlIBCIcs20Service.key,
  version: 1,
})
export default class CrawlIBCIcs20Service extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_ICS20,
    jobName: BULL_JOB_NAME.CRAWL_IBC_ICS20,
  })
  public async crawlIbcIcs20(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_IBC_ICS20,
        [BULL_JOB_NAME.CRAWL_IBC_APP],
        config.crawlIbcIcs20.key
      );
    this.logger.info(
      `Handle IBC/ICS20, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;
    await knex.transaction(async (trx) => {
      await this.handleIcs20Send(startHeight, endHeight, trx);
      await this.handleIcs20Recv(startHeight, endHeight, trx);
      await this.handleIcs20Ack(startHeight, endHeight, trx);
      await this.handleIcs20Timeout(startHeight, endHeight, trx);
      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
  }

  async handleIcs20Send(
    startHeight: number,
    endHeight: number,
    trx: Knex.Transaction
  ) {
    const ics20Sends = await IbcMessage.query()
      .joinRelated('message.transaction')
      .where('src_port_id', IbcMessage.PORTS.ICS20)
      .andWhere('ibc_message.type', IbcMessage.EVENT_TYPE.SEND_PACKET)
      .andWhere('message:transaction.height', '>', startHeight)
      .andWhere('message:transaction.height', '<=', endHeight)
      .orderBy('message.id')
      .transacting(trx);
    if (ics20Sends.length > 0) {
      const ibcIcs20s = ics20Sends.map((msg) =>
        IbcIcs20.fromJson({
          ibc_message_id: msg.id,
          ...msg.data,
          channel_id: msg.src_channel_id,
        })
      );
      await IbcIcs20.query().insert(ibcIcs20s).transacting(trx);
    }
  }

  async handleIcs20Recv(
    startHeight: number,
    endHeight: number,
    trx: Knex.Transaction
  ) {
    const ics20Recvs = await IbcMessage.query()
      .withGraphFetched('message.events(selectIcs20Event).attributes')
      .joinRelated('message.transaction')
      .modifiers({
        selectIcs20Event(builder) {
          builder
            .where('type', IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET)
            .orWhere('type', IbcIcs20.EVENT_TYPE.DENOM_TRACE);
        },
      })
      .where('dst_port_id', IbcMessage.PORTS.ICS20)
      .andWhere('ibc_message.type', IbcMessage.EVENT_TYPE.RECV_PACKET)
      .andWhere('message:transaction.height', '>', startHeight)
      .andWhere('message:transaction.height', '<=', endHeight)
      .orderBy('message.id')
      .transacting(trx);
    if (ics20Recvs.length > 0) {
      const ibcIcs20s = ics20Recvs.map((msg) => {
        const recvEvent = msg.message.events.find(
          (e) => e.type === IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET
        );
        if (recvEvent === undefined) {
          throw Error(`Recv ibc hasn't emmitted events: ${msg.id}`);
        }
        const [sender, receiver, amount, originalDenom, ackStatus] =
          recvEvent.getAttributesFrom([
            EventAttribute.ATTRIBUTE_KEY.SENDER,
            EventAttribute.ATTRIBUTE_KEY.RECEIVER,
            EventAttribute.ATTRIBUTE_KEY.AMOUNT,
            EventAttribute.ATTRIBUTE_KEY.DENOM,
            EventAttribute.ATTRIBUTE_KEY.SUCCESS,
          ]);
        if (originalDenom === undefined) {
          throw Error(`Recv ibc hasn't emit denom: ${msg.id}`);
        }
        const isSource =
          msg.message.events.find(
            (e) => e.type === IbcIcs20.EVENT_TYPE.DENOM_TRACE
          ) === undefined;
        const denom = this.parseDenom(
          originalDenom,
          isSource,
          msg.dst_port_id,
          msg.dst_channel_id
        );
        return IbcIcs20.fromJson({
          ibc_message_id: msg.id,
          sender,
          receiver,
          amount,
          denom,
          status: ackStatus === 'true',
          channel_id: msg.dst_channel_id,
        });
      });
      await IbcIcs20.query().insert(ibcIcs20s).transacting(trx);
    }
  }

  async handleIcs20Ack(
    startHeight: number,
    endHeight: number,
    trx: Knex.Transaction
  ) {
    const ics20Acks = await IbcMessage.query()
      .withGraphFetched('message.events(selectIcs20Event).attributes')
      .joinRelated('message.transaction')
      .modifiers({
        selectIcs20Event(builder) {
          builder.where('type', IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET);
        },
      })
      .where('src_port_id', IbcMessage.PORTS.ICS20)
      .andWhere('ibc_message.type', IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET)
      .andWhere('message:transaction.height', '>', startHeight)
      .andWhere('message:transaction.height', '<=', endHeight)
      .orderBy('message.id')
      .transacting(trx);
    if (ics20Acks.length > 0) {
      const ibcIcs20s = ics20Acks.map((msg) => {
        const ackEvents = msg.message.events;
        if (ackEvents.length !== 2) {
          throw Error(`Ack ibc hasn't emmitted enough events: ${msg.id}`);
        }
        const [sender, receiver, amount, denom, success] = [
          ...ackEvents[0].getAttributesFrom([
            EventAttribute.ATTRIBUTE_KEY.SENDER,
            EventAttribute.ATTRIBUTE_KEY.RECEIVER,
            EventAttribute.ATTRIBUTE_KEY.AMOUNT,
            EventAttribute.ATTRIBUTE_KEY.DENOM,
          ]),
          ...ackEvents[1].getAttributesFrom([
            EventAttribute.ATTRIBUTE_KEY.SUCCESS,
          ]),
        ];

        return IbcIcs20.fromJson({
          ibc_message_id: msg.id,
          sender,
          receiver,
          amount,
          denom,
          status: success !== undefined,
          channel_id: msg.src_channel_id,
        });
      });
      await IbcIcs20.query().insert(ibcIcs20s).transacting(trx);
    }
  }

  async handleIcs20Timeout(
    startHeight: number,
    endHeight: number,
    trx: Knex.Transaction
  ) {
    const ics20Timeouts = await IbcMessage.query()
      .withGraphFetched('message.events(selectIcs20Event).attributes')
      .joinRelated('message.transaction')
      .modifiers({
        selectIcs20Event(builder) {
          builder.where('type', IbcIcs20.EVENT_TYPE.TIMEOUT);
        },
      })
      .where('src_port_id', IbcMessage.PORTS.ICS20)
      .andWhere('ibc_message.type', IbcMessage.EVENT_TYPE.TIMEOUT_PACKET)
      .andWhere('message:transaction.height', '>', startHeight)
      .andWhere('message:transaction.height', '<=', endHeight)
      .orderBy('message.id')
      .transacting(trx);
    if (ics20Timeouts.length > 0) {
      const ibcIcs20s = ics20Timeouts.map((msg) => {
        const timeoutEvent = msg.message.events[0];
        const [receiver, amount, denom] = timeoutEvent.getAttributesFrom([
          EventAttribute.ATTRIBUTE_KEY.REFUND_RECEIVER,
          EventAttribute.ATTRIBUTE_KEY.REFUND_AMOUNT,
          EventAttribute.ATTRIBUTE_KEY.REFUND_DENOM,
        ]);
        return IbcIcs20.fromJson({
          ibc_message_id: msg.id,
          receiver,
          amount,
          denom,
          channel_id: msg.src_channel_id,
          status: false,
        });
      });
      await IbcIcs20.query().insert(ibcIcs20s).transacting(trx);
    }
  }

  parseDenom(
    denom: string,
    isSource: boolean,
    dstPort: string,
    dstChannel: string
  ) {
    if (isSource) {
      const tokens2 = denom.split('/').slice(2);
      return tokens2.join('/');
    }
    return `${dstPort}/${dstChannel}/${denom}`;
  }

  async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_IBC_ICS20,
      BULL_JOB_NAME.CRAWL_IBC_ICS20,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlIbcIcs20.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}

import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import {
  Block,
  Event,
  EventAttribute,
  IbcIcs20,
  IbcMessage,
  Transaction,
} from '../../../../src/models';
import CrawlIbcIcs20 from '../../../../src/services/ibc/crawl_ibc_ics20.service';
import config from '../../../../config.json' assert { type: 'json' };
import { getAttributeFrom } from '../../../../src/common/utils/smart_contract';

const PORT = config.crawlIbcIcs20.port;
@Describe('Test crawl ibc-ics20 service')
export default class CrawlIbcIcs20Test {
  broker = new ServiceBroker({ logger: false });

  crawlIbcIcs20Serivce = this.broker.createService(
    CrawlIbcIcs20
  ) as CrawlIbcIcs20;

  block: Block = Block.fromJson({
    height: 30000,
    hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
    time: '2023-01-12T01:53:57.216Z',
    proposer_address: 'auraomd;cvpio3j4eg',
    data: {},
  });

  transaction = {
    ...Transaction.fromJson({
      height: this.block.height,
      hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      codespace: '',
      code: 0,
      gas_used: '123035',
      gas_wanted: '141106',
      gas_limit: '141106',
      fee: 353,
      timestamp: '2023-01-12T01:53:57.000Z',
      index: 0,
      data: {
        tx_response: {
          logs: [],
        },
      },
    }),
    messages: [
      {
        index: 1,
        type: '/cosmwasm.wasm.v1.MsgExecuteContract',
        sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
        content: {
          msg: '{"add_mint_phase":{"phase_data":{"start_time":"1679976124941000000","end_time":"1679982024941000000","max_supply":2000,"max_nfts_per_address":20,"price":{"amount":"10","denom":"ueaura"},"is_public":false},"token_id": "test"}}',
          '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
          funds: [],
          sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
        },
      },
    ],
  };

  @BeforeAll()
  async initSuite() {
    this.crawlIbcIcs20Serivce.getQueueManager().stopAll();
    await knex.raw(
      'TRUNCATE TABLE block, transaction, transaction_message, ibc_message RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.transaction);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test handleIcs20Send')
  async testHandleIcs20Send() {
    await knex.transaction(async (trx) => {
      const ibcMessage = IbcMessage.fromJson({
        transaction_message_id: 1,
        src_channel_id: 'aaa',
        src_port_id: PORT,
        dst_channel_id: 'cccc',
        dst_port_id: 'dddd',
        type: IbcMessage.EVENT_TYPE.SEND_PACKET,
        sequence: 256,
        sequence_key: 'hcc',
        data: {
          amount: '10000',
          denom: 'uatom',
          receiver:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
          sender: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
      });
      const message = await IbcMessage.query()
        .insert(ibcMessage)
        .transacting(trx);
      await this.crawlIbcIcs20Serivce.handleIcs20Send(
        this.block.height - 1,
        this.block.height,
        trx
      );
      const result = await IbcIcs20.query().first().transacting(trx);
      expect(result?.ibc_message_id).toEqual(message.id);
      expect(result?.sender).toEqual(ibcMessage.data.sender);
      expect(result?.receiver).toEqual(ibcMessage.data.receiver);
      expect(result?.amount).toEqual(ibcMessage.data.amount);
      expect(result?.denom).toEqual(ibcMessage.data.denom);
      expect(result?.status).toEqual(IbcIcs20.STATUS_TYPE.ONGOING);
      expect(result?.sequence_key).toEqual(ibcMessage.sequence_key);
      expect(result?.type).toEqual(ibcMessage.type);
      expect(result?.channel_id).toEqual(ibcMessage.src_channel_id);
      expect(result?.finish_time).toBeNull();
      expect(result?.start_time).toEqual(new Date(this.transaction.timestamp));
    });
  }

  @Test('Test handleIcs20Recv from source chain')
  async testHandleIcs20RecvFromSource() {
    await knex.transaction(async (trx) => {
      const ibcMessage = IbcMessage.fromJson({
        transaction_message_id: 1,
        src_channel_id: 'aaa',
        src_port_id: 'bbbb',
        dst_channel_id: 'cccc',
        dst_port_id: PORT,
        type: IbcMessage.EVENT_TYPE.RECV_PACKET,
        sequence: 256,
        sequence_key: 'hcc',
        data: {
          amount: '10000',
          denom: 'uatom',
          receiver:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
          sender: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
      });
      const ibcMsg = await IbcMessage.query()
        .insert(ibcMessage)
        .transacting(trx);
      const event1Attrs = [
        {
          key: 'module',
          value: 'transfer',
        },
        {
          key: 'sender',
          value: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
        {
          key: 'receiver',
          value: 'stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl',
        },
        {
          key: 'denom',
          value: 'uatom',
        },
        {
          key: 'amount',
          value: '10000',
        },
        {
          key: 'memo',
          value: '',
        },
        {
          key: 'success',
          value: 'true',
        },
      ];
      const event2Attrs = [
        {
          key: 'trace_hash',
          value:
            '40CA5EF447F368B7F2276A689383BE3C427B15395D4BF6639B605D36C0846A20',
        },
        {
          key: 'denom',
          value:
            'ibc/40CA5EF447F368B7F2276A689383BE3C427B15395D4BF6639B605D36C0846A20',
        },
      ];
      const events = [
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event1Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.DENOM_TRACE,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event2Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
      ];
      await Event.query().insertGraph(events).transacting(trx);
      await this.crawlIbcIcs20Serivce.handleIcs20Recv(
        this.block.height - 1,
        this.block.height,
        trx
      );
      const result = await IbcIcs20.query()
        .where('type', IbcMessage.EVENT_TYPE.RECV_PACKET)
        .first()
        .transacting(trx);
      expect(result?.ibc_message_id).toEqual(ibcMsg.id);
      expect(result?.receiver).toEqual(
        getAttributeFrom(event1Attrs, EventAttribute.ATTRIBUTE_KEY.RECEIVER)
      );
      expect(result?.sender).toEqual(
        getAttributeFrom(event1Attrs, EventAttribute.ATTRIBUTE_KEY.SENDER)
      );
      expect(result?.amount).toEqual(
        getAttributeFrom(event1Attrs, EventAttribute.ATTRIBUTE_KEY.AMOUNT)
      );
      expect(result?.denom).toEqual(
        `${ibcMessage.dst_port_id}/${
          ibcMessage.dst_channel_id
        }/${getAttributeFrom(event1Attrs, EventAttribute.ATTRIBUTE_KEY.DENOM)}`
      );
      expect(result?.status).toEqual(IbcIcs20.STATUS_TYPE.ACK_SUCCESS);
      expect(result?.sequence_key).toEqual(ibcMessage.sequence_key);
      expect(result?.type).toEqual(ibcMessage.type);
      expect(result?.channel_id).toEqual(ibcMessage.dst_channel_id);
      expect(result?.start_time).toBeNull();
      expect(result?.finish_time).toEqual(new Date(this.transaction.timestamp));
      await trx.rollback();
    });
  }

  @Test('Test handleIcs20Recv from sink chain')
  async testHandleIcs20RecvFromSink() {
    await knex.transaction(async (trx) => {
      const ibcMessage = IbcMessage.fromJson({
        transaction_message_id: 1,
        src_channel_id: 'aaa',
        src_port_id: 'bbbb',
        dst_channel_id: 'cccc',
        dst_port_id: PORT,
        type: IbcMessage.EVENT_TYPE.RECV_PACKET,
        sequence: 256,
        sequence_key: 'hcc',
        data: {
          amount: '10000',
          denom: 'uatom',
          receiver:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
          sender: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
      });
      const ibcMsg = await IbcMessage.query()
        .insert(ibcMessage)
        .transacting(trx);
      const event1Attrs = [
        {
          key: 'module',
          value: 'transfer',
        },
        {
          key: 'sender',
          value: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
        {
          key: 'receiver',
          value: 'stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl',
        },
        {
          key: 'denom',
          value: 'hhhh/jjjjj/uatom',
        },
        {
          key: 'amount',
          value: '10000',
        },
        {
          key: 'memo',
          value: '',
        },
        {
          key: 'success',
          value: 'true',
        },
      ];
      const events = [
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event1Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
      ];
      await Event.query().insertGraph(events).transacting(trx);
      await this.crawlIbcIcs20Serivce.handleIcs20Recv(
        this.block.height - 1,
        this.block.height,
        trx
      );
      const result = await IbcIcs20.query()
        .where('type', IbcMessage.EVENT_TYPE.RECV_PACKET)
        .first()
        .transacting(trx);
      expect(result?.ibc_message_id).toEqual(ibcMsg.id);
      expect(result?.receiver).toEqual(
        getAttributeFrom(event1Attrs, EventAttribute.ATTRIBUTE_KEY.RECEIVER)
      );
      expect(result?.sender).toEqual(
        getAttributeFrom(event1Attrs, EventAttribute.ATTRIBUTE_KEY.SENDER)
      );
      expect(result?.amount).toEqual(
        getAttributeFrom(event1Attrs, EventAttribute.ATTRIBUTE_KEY.AMOUNT)
      );
      expect(result?.denom).toEqual('uatom');
      expect(result?.status).toEqual(IbcIcs20.STATUS_TYPE.ACK_SUCCESS);
      expect(result?.sequence_key).toEqual(ibcMessage.sequence_key);
      expect(result?.type).toEqual(ibcMessage.type);
      expect(result?.channel_id).toEqual(ibcMessage.dst_channel_id);
      expect(result?.start_time).toBeNull();
      expect(result?.finish_time).toEqual(new Date(this.transaction.timestamp));
      await trx.rollback();
    });
  }

  @Test('Test handleIcs20AckError')
  async testHandleIcs20AckError() {
    await knex.transaction(async (trx) => {
      const ibcMessage = IbcMessage.fromJson({
        transaction_message_id: 1,
        src_channel_id: 'aaa',
        src_port_id: PORT,
        dst_channel_id: 'cccc',
        dst_port_id: 'dddd',
        type: IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET,
        sequence: 256,
        sequence_key: 'hcc',
        data: {
          amount: '10000',
          denom: 'uatom',
          receiver:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
          sender: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
      });
      await IbcMessage.query().insert(ibcMessage).transacting(trx);
      const event1Attrs = [
        {
          key: 'module',
          value: 'transfer',
        },
        {
          key: 'sender',
          value: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
        {
          key: 'receiver',
          value:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
        },
        {
          key: 'denom',
          value: 'uatom',
        },
        {
          key: 'amount',
          value: '10000',
        },
        {
          key: 'memo',
          value: '',
        },
        {
          key: 'acknowledgement',
          value: 'result:"\\001" ',
        },
      ];
      const event2Attrs = [
        {
          key: 'error',
          value: '\u0001',
        },
      ];
      const events = [
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event1Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event2Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
      ];
      await Event.query().insertGraph(events).transacting(trx);
      await this.crawlIbcIcs20Serivce.handleIcs20Ack(
        this.block.height - 1,
        this.block.height,
        trx
      );
      const originSend = await IbcIcs20.query()
        .where('type', IbcMessage.EVENT_TYPE.SEND_PACKET)
        .first()
        .transacting(trx);
      expect(originSend?.status).toEqual(IbcIcs20.STATUS_TYPE.ACK_ERROR);
      expect(originSend?.finish_time).toEqual(
        new Date(this.transaction.timestamp)
      );
      await trx.rollback();
    });
  }

  @Test('Test handleIcs20AckSuccess')
  async testHandleIcs20AckSuccess() {
    await knex.transaction(async (trx) => {
      const ibcMessage = IbcMessage.fromJson({
        transaction_message_id: 1,
        src_channel_id: 'aaa',
        src_port_id: PORT,
        dst_channel_id: 'cccc',
        dst_port_id: 'dddd',
        type: IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET,
        sequence: 256,
        sequence_key: 'hcc',
        data: {
          amount: '10000',
          denom: 'uatom',
          receiver:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
          sender: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
      });
      await IbcMessage.query().insert(ibcMessage).transacting(trx);
      const event1Attrs = [
        {
          key: 'module',
          value: 'transfer',
        },
        {
          key: 'sender',
          value: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
        {
          key: 'receiver',
          value:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
        },
        {
          key: 'denom',
          value: 'uatom',
        },
        {
          key: 'amount',
          value: '10000',
        },
        {
          key: 'memo',
          value: '',
        },
        {
          key: 'acknowledgement',
          value: 'result:"\\001" ',
        },
      ];
      const event2Attrs = [
        {
          key: 'success',
          value: '\u0001',
        },
      ];
      const events = [
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event1Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.FUNGIBLE_TOKEN_PACKET,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event2Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
      ];
      await Event.query().insertGraph(events).transacting(trx);
      await this.crawlIbcIcs20Serivce.handleIcs20Ack(
        this.block.height - 1,
        this.block.height,
        trx
      );
      const originSend = await IbcIcs20.query()
        .where('type', IbcMessage.EVENT_TYPE.SEND_PACKET)
        .first()
        .transacting(trx);
      expect(originSend?.status).toEqual(IbcIcs20.STATUS_TYPE.ACK_SUCCESS);
      expect(originSend?.finish_time).toEqual(
        new Date(this.transaction.timestamp)
      );
      await trx.rollback();
    });
  }

  @Test('Test handleIcs20Timeout')
  async testHandleIcs20Timeout() {
    await knex.transaction(async (trx) => {
      const ibcMessage = IbcMessage.fromJson({
        transaction_message_id: 1,
        src_channel_id: 'aaa',
        src_port_id: PORT,
        dst_channel_id: 'cccc',
        dst_port_id: 'dddd',
        type: IbcMessage.EVENT_TYPE.TIMEOUT_PACKET,
        sequence: 256,
        sequence_key: 'hcc',
        data: {
          amount: '10000',
          denom: 'uatom',
          receiver:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
          sender: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
      });
      await IbcMessage.query().insert(ibcMessage).transacting(trx);
      const event1Attrs = [
        {
          key: 'module',
          value: 'transfer',
        },
        {
          key: 'refund_receiver',
          value: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
        },
        {
          key: 'refund_denom',
          value: 'utaura',
        },
        {
          key: 'refund_amount',
          value: '1000000',
        },
        {
          key: 'memo',
          value: '',
        },
      ];
      const events = [
        Event.fromJson({
          tx_id: 1,
          tx_msg_index: 1,
          type: IbcIcs20.EVENT_TYPE.TIMEOUT,
          block_height: this.block.height,
          source: 'TX_EVENT',
          attributes: event1Attrs.map((e, index) => {
            Object.assign(e, {
              block_height: this.block.height,
              event_id: 1,
              index,
            });
            return e;
          }),
        }),
      ];
      await Event.query()
        .insertGraph(events)
        .where('type', IbcMessage.EVENT_TYPE.TIMEOUT_PACKET)
        .transacting(trx);
      await this.crawlIbcIcs20Serivce.handleIcs20Timeout(
        this.block.height - 1,
        this.block.height,
        trx
      );
      const originSend = await IbcIcs20.query()
        .where('type', IbcMessage.EVENT_TYPE.SEND_PACKET)
        .first()
        .transacting(trx);
      expect(originSend?.status).toEqual(IbcIcs20.STATUS_TYPE.TIMEOUT);
      expect(originSend?.finish_time).toEqual(
        new Date(this.transaction.timestamp)
      );
      await trx.rollback();
    });
  }

  @Test('test sei ack')
  async testSeiAck() {
    await knex.transaction(async (trx) => {
      const seiBlock = Block.fromJson({
        height: 40000,
        hash: '8401997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43XYZD',
        time: '2023-01-12T01:53:57.216Z',
        proposer_address: 'auraomd;cvpio3j4eg',
        data: {},
      });
      const seiAckTx = {
        ...Transaction.fromJson({
          height: seiBlock.height,
          hash: 'A45B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997P',
          codespace: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          index: 0,
          data: {
            tx_response: {
              logs: [],
            },
          },
        }),
        messages: [
          {
            index: 1,
            sender: '',
            type: '/ibc.core.channel.v1.MsgAcknowledgement',
            content: {
              '@type': '/ibc.core.channel.v1.MsgAcknowledgement',
              packet: {
                data: {
                  denom: 'usei',
                  amount: '1000000',
                  sender: 'sei1uqqm8mxd945dl6l94rmcajq84feeuv8wauj9rw',
                  receiver: 'cosmos1uqqm8mxd945dl6l94rmcajq84feeuv8wssrn90',
                },
                sequence: '574',
                source_port: 'transfer',
                source_channel: 'channel-1',
                timeout_height: {
                  revision_height: '18544467',
                  revision_number: '4',
                },
                destination_port: 'transfer',
                timeout_timestamp: '0',
                destination_channel: 'channel-584',
              },
              signer: 'sei1ym3rcer9p0cehj380tdp2qfpa6ksvtcf6jhj8g',
              proof_acked:
                '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',
              proof_height: {
                revision_height: '18544320',
                revision_number: '4',
              },
              acknowledgement: {
                error: 'AQ==',
              },
            },
          },
        ],
      };
      await Block.query().insert(seiBlock).transacting(trx);
      await Transaction.query().insertGraph(seiAckTx).transacting(trx);
      const ibcMessage = IbcMessage.fromJson({
        transaction_message_id: 2,
        src_channel_id: 'aaa',
        src_port_id: PORT,
        dst_channel_id: 'cccc',
        dst_port_id: 'dddd',
        type: IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET,
        sequence: 256,
        sequence_key: 'hcc',
        data: {
          amount: '10000',
          denom: 'uatom',
          receiver:
            '{"autopilot":{"stakeibc":{"stride_address":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl","action":"LiquidStake"},"receiver":"stride1e8288j8swfy7rwkyx0h3lz82fe58vz2medxndl"}}',
          sender: 'cosmos1e8288j8swfy7rwkyx0h3lz82fe58vz2m6xx0en',
        },
      });
      await IbcMessage.query().insert(ibcMessage).transacting(trx);
      await this.crawlIbcIcs20Serivce.handleIcs20Ack(
        seiBlock.height - 1,
        seiBlock.height,
        trx
      );
      const originSend = await IbcIcs20.query()
        .where('type', IbcMessage.EVENT_TYPE.SEND_PACKET)
        .first()
        .transacting(trx);
      expect(originSend?.status).toEqual(IbcIcs20.STATUS_TYPE.ACK_ERROR);
      expect(originSend?.finish_time).toEqual(
        new Date(this.transaction.timestamp)
      );
      await trx.rollback();
    });
  }
}

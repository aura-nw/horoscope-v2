import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import { Block, Event, IbcMessage, Transaction } from '../../../../src/models';
import CrawlIbcAppService from '../../../../src/services/ibc/crawl_ibc_app.service';

@Describe('Test crawl ibc service')
export default class CrawlIbcTest {
  broker = new ServiceBroker({ logger: false });

  crawlIbcAppSerivce = this.broker.createService(
    CrawlIbcAppService
  ) as CrawlIbcAppService;

  block: Block = Block.fromJson({
    height: 1300000,
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
    this.crawlIbcAppSerivce.getQueueManager().stopAll();
    await knex.raw(
      'TRUNCATE TABLE block, transaction, ibc_message RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.transaction);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test HandleIbcSendPacket')
  async testHandleIbcSendPacket() {
    await knex.transaction(async (trx) => {
      const content = {
        '@type': '/ibc.applications.transfer.v1.MsgTransfer',
        token: {
          denom: 'ueaura',
          amount: '2000000',
        },
        sender: 'aura1qqq4cecm6yvaep46729096urqq30k3kp2mctfw',
        receiver: 'axelar1qqq4cecm6yvaep46729096urqq30k3kp4repqk',
        source_port: 'transfer',
        source_channel: 'channel-5',
        timeout_height: {
          revision_height: '5272159',
          revision_number: '3',
        },
        timeout_timestamp: '0',
      };
      const attributes = [
        {
          key: 'packet_data',
          value:
            '{"amount":"2000000","denom":"ueaura","receiver":"axelar1qqq4cecm6yvaep46729096urqq30k3kp4repqk","sender":"aura1qqq4cecm6yvaep46729096urqq30k3kp2mctfw"}',
          event_id: '1',
        },
        {
          event_id: '1',
          key: 'packet_data_hex',
          value:
            '7b22616d6f756e74223a2232303030303030222c2264656e6f6d223a22756561757261222c227265636569766572223a226178656c617231717171346365636d36797661657034363732393039367572717133306b336b7034726570716b222c2273656e646572223a226175726131717171346365636d36797661657034363732393039367572717133306b336b70326d63746677227d',
        },
        {
          event_id: '1',
          key: 'packet_timeout_height',
          value: '3-5272159',
        },
        {
          event_id: '1',
          key: 'packet_timeout_timestamp',
          value: '0',
        },
        {
          event_id: '1',
          key: 'packet_sequence',
          value: '68',
        },
        {
          event_id: '1',
          key: 'packet_src_port',
          value: 'transfer',
        },
        {
          event_id: '1',
          key: 'packet_src_channel',
          value: 'channel-5',
        },
        {
          event_id: '1',
          key: 'packet_dst_port',
          value: 'transfer',
        },
        {
          event_id: '1',
          key: 'packet_dst_channel',
          value: 'channel-48',
        },
        {
          event_id: '1',
          key: 'packet_channel_ordering',
          value: 'ORDER_UNORDERED',
        },
        {
          event_id: '1',
          key: 'packet_connection',
          value: 'connection-3',
        },
      ];
      const event = Event.fromJson({
        type: IbcMessage.EVENT_TYPE.SEND_PACKET,
        attributes,
        content,
        message_id: 1,
        tx_hash: this.transaction.hash,
      });
      await this.crawlIbcAppSerivce.handleIbcMessage([event], trx);
      const newPacket = await IbcMessage.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newPacket.src_channel_id).toEqual(attributes[6].value);
      expect(newPacket.src_port_id).toEqual(attributes[5].value);
      expect(newPacket.dst_port_id).toEqual(attributes[7].value);
      expect(newPacket.dst_channel_id).toEqual(attributes[8].value);
      expect(newPacket.type).toEqual(event.type);
      expect(newPacket.sequence).toEqual(parseInt(attributes[4].value, 10));
      expect(newPacket.data).toEqual(JSON.parse(attributes[0].value));
      expect(newPacket.tx_hash).toEqual(this.transaction.hash);
      await trx.rollback();
    });
  }

  @Test('Test HandleIbcReceivePacket')
  async testHandleIbcReceivePacket() {
    await knex.transaction(async (trx) => {
      const content = {
        '@type': '/ibc.core.channel.v1.MsgRecvPacket',
        packet: {
          data: 'eyJzb3VyY2VfaWQiOiJkcmFuZDo4OTkwZTdhOWFhZWQyZmZlZDczZGJkNzA5MjEyM2Q2ZjI4OTkzMDU0MGQ3NjUxMzM2MjI1ZGMxNzJlNTFiMmNlOjI1MTg3NDMiLCJyYW5kb21uZXNzIjoiYzY3ZmI4NzBmZDkyOTY1YmJjOTIzMjFiYmZlNzEyZmE3ZDhlZTI3NzUwNzg5NDdjOGIxYmZjZTcwOTIwNGRjNyIsInNlbmRlciI6ImF1cmExbW5kY2V1Y3czYzZqOXNxanFkbWxzNGNmcHhrNWUwbTRwMGF4ZnJwN3p3c2ZuM2tuZmg0czJ5a2Z6cyIsImpvYl9pZCI6ImpvYiB0ZXN0In0=',
          sequence: '1',
          source_port:
            'wasm.nois1s9ly26evj8ehurptws5d6dm4a9g2z0htcqvlvn95kc30eucl4s5sd8hkgp',
          source_channel: 'channel-24',
          destination_port:
            'wasm.aura1qrf8f9kyh4zzckz2zy52z5gppwweumvrlxqrgd4xr3ydf3sx4dlqt8lnt8',
          timeout_timestamp: '1671007842016312592',
          destination_channel: 'channel-15',
        },
        signer: 'aura1rynf2jnj38sh96xztpp4f7v93ceefp0592kqu9',
        proof_height: {
          revision_height: '2051376',
          revision_number: '0',
        },
        proof_commitment:
          'CrUICrIICnZjb21taXRtZW50cy9wb3J0cy93YXNtLm5vaXMxczlseTI2ZXZqOGVodXJwdHdzNWQ2ZG00YTlnMnowaHRjcXZsdm45NWtjMzBldWNsNHM1c2Q4aGtncC9jaGFubmVscy9jaGFubmVsLTI0L3NlcXVlbmNlcy8xEiBr6YV/hrYcXxxkci3Xg1iZO+R16mZdozncKdfF2Gk63hoOCAEYASABKgYAAra0+gEiLAgBEigCBNy0+gEgkbRLrBYqrFQSnylScee3SDJG9IoyvSE1NNKbhkMHjOkgIiwIARIoBAjctPoBIFJzzlvVwrtiCBp6IW4mz1U331PxUnDG3SWldAaUkqfKICIsCAESKAYO3LT6ASCjyAp5hOD2V8Ief2zE1EHS9ij+4lqh8GuQFftw1HGXySAiLggBEgcIHNy0+gEgGiEgJwCb/SGlVkH+fKcOy+VGdm52r9/CAIOXf3YJiLqBB1EiLAgBEigMRty0+gEg/Ydg1h01rorKZB7q9yuNLzyIogB6CEsbkyAbvDpoRZ0gIiwIARIoDnbctPoBIJc1GUCFYMDe51mf7/PX8k7Nsygm/97skEy3Md/hB9TSICItCAESKRCwAty0+gEgGY4ZdbCvnIfCl6jIyIpEYN3s27Fr1vyz8R3IHvX3Xm4gIi0IARIpErAF3LT6ASCRW2Sj0oCdYO4sfTggs1obpqP0SpyxZ5MNwnDNxOttzCAiLQgBEikUvAnctPoBIKc6KVNR+IjCyjUf5EmvbhCZ4ECjFfvkTS07NGG6KatHICItCAESKRb8Ddy0+gEgIk0VggsrBqM0r7bRn8tGGGb/F0OAsrkFEQlX/iIieCAgIi0IARIpGNIo3LT6ASCzl9mIXiGdiLc3Uxffs3deucwOkYLHyrOPT43POSwokSAiLwgBEggawDbctPoBIBohIDh+V4oXbhCCw2amCons5wswvWLj9GrgDmXX9ZyHzSnHIi4IARIqHsycAdy0+gEgd8O9IlSfy76C4PEut+OmsBaczmZAQIk+9lKXjKi5tPQgIi4IARIqIOSKBNy0+gEgRGhbs7TW2G7HEGOkWlnscrIJzrGFK7Av1al0Kn0evkIgIjAIARIJIu6GBdy0+gEgGiEgdYbS/e3tGdCHBK0jStUByTHfWzSAgSTuPFSABAtrvUIiMAgBEgkknPEG3LT6ASAaISAknxyxnWyS0b5tJENZdboudAgOecP6nXWoNxKCyEviaiIwCAESCSa2zw3ctPoBIBohIPNrCQdaLVoHfv59FzZZ0mu0dpj4s1yHQJDSXgI9LgyXIi4IARIqKIzpIdy0+gEgO8+y5H2wuEYl5+E29n5CHoa9L0Gv7VDK/c18U3RbpbggIi4IARIqLMjqSty0+gEg1bxzwt2bpr7IcwoFmALxeBtNJnp9orfUEwo/J2ejlo8gCoACCv0BCgNpYmMSIKpvHTP9V5wDV+p0HZXGImeQnu1m2wR4GuhY+MtrIZQNGgkIARgBIAEqAQAiJwgBEgEBGiDFBcD9SLHPK2VhnxKzFE4ZxgtOa2JSXuk2vpPQQWI+vyInCAESAQEaIB383KmKPeE797r2aZUc+sDGl1kl76j7wuBRZXW53aliIicIARIBARogHzoHZq3bsksS+szusIxZLYKclF851/17/U+U55WvjH0iJQgBEiEBh8vGkXW12Po8VvqN1YvoDbUvWlI7YprnoRvl4apyqUQiJwgBEgEBGiBWtkpHzlP2mQZ1Go55X55ylakOo+xlkABwsGtDJUAQ5Q==',
      };
      const attributes = [
        {
          event_id: 1,
          key: 'packet_data',
          value:
            '{"source_id":"drand:8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce:2518743","randomness":"c67fb870fd92965bbc92321bbfe712fa7d8ee2775078947c8b1bfce709204dc7","sender":"aura1mndceucw3c6j9sqjqdmls4cfpxk5e0m4p0axfrp7zwsfn3knfh4s2ykfzs","job_id":"job test"}',
        },
        {
          event_id: 1,
          key: 'packet_data_hex',
          value:
            '7b22736f757263655f6964223a226472616e643a383939306537613961616564326666656437336462643730393231323364366632383939333035343064373635313333363232356463313732653531623263653a32353138373433222c2272616e646f6d6e657373223a2263363766623837306664393239363562626339323332316262666537313266613764386565323737353037383934376338623162666365373039323034646337222c2273656e646572223a2261757261316d6e6463657563773363366a3973716a71646d6c7334636670786b3565306d3470306178667270377a7773666e336b6e6668347332796b667a73222c226a6f625f6964223a226a6f622074657374227d',
        },
        {
          event_id: 1,
          key: 'packet_timeout_height',
          value: '0-0',
        },
        {
          event_id: 1,
          key: 'packet_timeout_timestamp',
          value: '1671007842016312592',
        },
        {
          event_id: 1,
          key: 'packet_sequence',
          value: '1',
        },
        {
          event_id: 1,
          key: 'packet_src_port',
          value:
            'wasm.nois1s9ly26evj8ehurptws5d6dm4a9g2z0htcqvlvn95kc30eucl4s5sd8hkgp',
        },
        {
          event_id: 1,
          key: 'packet_src_channel',
          value: 'channel-24',
        },
        {
          event_id: 1,
          key: 'packet_dst_port',
          value:
            'wasm.aura1qrf8f9kyh4zzckz2zy52z5gppwweumvrlxqrgd4xr3ydf3sx4dlqt8lnt8',
        },
        {
          event_id: 1,
          key: 'packet_dst_channel',
          value: 'channel-15',
        },
        {
          event_id: 1,
          key: 'packet_channel_ordering',
          value: 'ORDER_UNORDERED',
        },
        {
          event_id: 1,
          key: 'packet_connection',
          value: 'connection-18',
        },
      ];
      const event = Event.fromJson({
        type: IbcMessage.EVENT_TYPE.RECV_PACKET,
        attributes,
        content,
        message_id: 1,
        tx_hash: this.transaction.hash,
      });
      await this.crawlIbcAppSerivce.handleIbcMessage([event], trx);
      const newPacket = await IbcMessage.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newPacket.src_channel_id).toEqual(attributes[6].value);
      expect(newPacket.src_port_id).toEqual(attributes[5].value);
      expect(newPacket.dst_port_id).toEqual(attributes[7].value);
      expect(newPacket.dst_channel_id).toEqual(attributes[8].value);
      expect(newPacket.type).toEqual(event.type);
      expect(newPacket.sequence).toEqual(parseInt(attributes[4].value, 10));
      expect(newPacket.data).toEqual(JSON.parse(attributes[0].value));
      expect(newPacket.tx_hash).toEqual(this.transaction.hash);
      await trx.rollback();
    });
  }

  @Test('Test HandleIbcAckPacket')
  async testHandleIbcAckPacket() {
    await knex.transaction(async (trx) => {
      const content = {
        '@type': '/ibc.core.channel.v1.MsgAcknowledgement',
        packet: {
          data: {
            denom: 'ueaura',
            amount: '2000000',
            sender: 'aura1qqq4cecm6yvaep46729096urqq30k3kp2mctfw',
            receiver: 'axelar1qqq4cecm6yvaep46729096urqq30k3kp4repqk',
          },
          sequence: '70',
          source_port: 'transfer',
          source_channel: 'channel-5',
          timeout_height: {
            revision_height: '5272433',
            revision_number: '3',
          },
          destination_port: 'transfer',
          timeout_timestamp: '0',
          destination_channel: 'channel-48',
        },
        signer: 'aura144uvpm209vujung88063yguqu2t4pxam8qlzcl',
        proof_acked:
          'CvcHCvQHCjRhY2tzL3BvcnRzL3RyYW5zZmVyL2NoYW5uZWxzL2NoYW5uZWwtNDgvc2VxdWVuY2VzLzcwEiDk4mS81on8LJWRjs2NgRMw+qa5Riss4mL5z7CaATu7zxoOCAEYASABKgYAAtTLgwUiLAgBEigCBNTLgwUgsY73NAQp95aEYITDO1TYaZ89+2YcDYor+a1LC4XJctkgIi4IARIHBAbUy4MFIBohIIlBYKacV7IR2q8WXyJnVWmAeZVic61uXSehtFr2y702Ii4IARIHBgrUy4MFIBohIDHUbUw8RoCZl2Wx0dz54+WUsbBfDa6Zmexb/7ds7FrlIiwIARIoCBLUy4MFIJcwzVz1/aEQTrPbUSXeOu6V0GIwR9B5Fe4LgNPGP2HsICIsCAESKAoq1MuDBSBEUv4A7XistOZCvSLVYneqE5eyJVL71u8dlQM269ks1CAiLggBEgcMRNTLgwUgGiEgK4rDgfNiiMmzxJCBnFgfdk7gotZJUwuTisUwWIALky8iLAgBEigOcNTLgwUggR67/Cj4/9HbvCMEVApYUOyrpNKPi+ixw3Hu69oOEM0gIi0IARIpEL4B1MuDBSBLtWls5uYSbwyCEqFrRX0qrkskHYFpxl6iMqUsbg15TCAiLQgBEikUhAbUy4MFIGPlCJx+DRlvaAdVOlmkdR4yrwa12u7X+MNuJWnstcm+ICItCAESKRbQDNTLgwUgne8KWVfwUTHwtKt+N4JeuLA2eTdMLTPae16sBleZ9i8gIi8IARIIGJwU1MuDBSAaISAlyQEy4co8HScp9mOwxmT+54xC60l/RujMLZ0UQY1D1yItCAESKRqoJ9TLgwUg4/16hHKjfU/b/cGJ/elVImTflmDbNGJTUmH7TyAHDY4gIi0IARIpHJ5P1MuDBSCrlFOsxMBTwG/ULmdZd1FxNzMclVji1hITNEIjuTzeUiAiMAgBEgkeloQB1MuDBSAaISBamzC6oAWPluSakQhJDDL28Ick6W7bzK3Wci+zaQ5ZmCIwCAESCSCYgQLUy4MFIBohIO2Q0PKbX4ycf0DLLoiM46g6/cIGa/YuXoGnybF/ajXcIi4IARIqIuTGA9TLgwUgl7ev7UVaOt4Y+2+3MzrCd4I5tCy/QnXC6HW2cS3Jw/AgIi4IARIqJNLIBtTLgwUgIqkmWLJRQoaumYnv30l160wf56bqxe5VlqeyNKdvnd0gIjAIARIJKMrtFNTLgwUgGiEgAGipp/NfgeyJ/oAnXFeaxChIBfsJIYlHqPerz5RYV18iMAgBEgkqvOgg1MuDBSAaISBvQKHSn0bGkrQOLwDrR0dLpqOWo13BUGWEZD9cuYS5owr+AQr7AQoDaWJjEiAXBMSV5wfjh6PYbvEp/1nimbltZtOVgouKXb0KZtuXxxoJCAEYASABKgEAIiUIARIhAYaEml36WNEYpP9Nh1yNmrYXZTzq4bYigQ5h/xryTzNeIicIARIBARogFc/U9A/9Uia3YLYvLg9IUjtNLuXbpHoWAIptWKyS3/UiJwgBEgEBGiBjazpYRtM9Y+HZBtOQHXcWeJo3Ay4wqT//MpJ91bxz/CIlCAESIQHU1rzKX7ZidvkTePQ5DYHMxbnqKGC8jQoT9fF3ninSTyInCAESAQEaIEB8bwhFio2i6oAVI0jph4+6adeJMizyI8IFM6iUM+gK',
        proof_height: {
          revision_height: '5272299',
          revision_number: '3',
        },
        acknowledgement: {
          error:
            'ABCI code: 1: error handling packet on destination chain: see events for details',
        },
      };
      const attributes = [
        {
          key: 'packet_timeout_height',
          value: '3-5272433',
          event_id: 1,
        },
        {
          key: 'packet_timeout_timestamp',
          value: '0',
          event_id: 1,
        },
        {
          key: 'packet_sequence',
          value: '70',
          event_id: 1,
        },
        {
          key: 'packet_src_port',
          value: 'transfer',
          event_id: 1,
        },
        {
          key: 'packet_src_channel',
          value: 'channel-5',
          event_id: 1,
        },
        {
          key: 'packet_dst_port',
          value: 'transfer',
          event_id: 1,
        },
        {
          key: 'packet_dst_channel',
          value: 'channel-48',
          event_id: 1,
        },
        {
          key: 'packet_channel_ordering',
          value: 'ORDER_UNORDERED',
          event_id: 1,
        },
        {
          key: 'packet_connection',
          value: 'connection-3',
          event_id: 1,
        },
      ];
      const event = Event.fromJson({
        type: IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET,
        attributes,
        content,
        message_id: 1,
        tx_hash: this.transaction.hash,
      });
      await this.crawlIbcAppSerivce.handleIbcMessage([event], trx);
      const newPacket = await IbcMessage.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newPacket.src_channel_id).toEqual(attributes[4].value);
      expect(newPacket.src_port_id).toEqual(attributes[3].value);
      expect(newPacket.dst_port_id).toEqual(attributes[5].value);
      expect(newPacket.dst_channel_id).toEqual(attributes[6].value);
      expect(newPacket.type).toEqual(event.type);
      expect(newPacket.sequence).toEqual(parseInt(attributes[2].value, 10));
      expect(newPacket.data).toEqual(null);
      expect(newPacket.tx_hash).toEqual(this.transaction.hash);
      await trx.rollback();
    });
  }

  @Test('Test HandleIbcTimeoutPacket')
  async testHandleIbcTimeoutPacket() {
    await knex.transaction(async (trx) => {
      const content = {
        '@type': '/ibc.core.channel.v1.MsgTimeout',
        packet: {
          data: 'eyJhbW91bnQiOiIxMDAwIiwiZGVub20iOiJ1ZWF1cmEiLCJyZWNlaXZlciI6ImF4ZWxhcjF4cW4ydG5yZTg0Y211d2Z1ZGZmcnd4bXFrMDcwMnk2ZjNuNmwzZyIsInNlbmRlciI6ImF1cmExOGh3eWZ5dHZqY3VoN2praDR1ZTluNjBoMjR4cDd0bndoamh5bTYifQ==',
          sequence: '76',
          source_port: 'transfer',
          source_channel: 'channel-5',
          timeout_height: {
            revision_height: '6254585',
            revision_number: '3',
          },
          destination_port: 'transfer',
          timeout_timestamp: '1676722677558827165',
          destination_channel: 'channel-48',
        },
        signer: 'aura1wzjuznqenty8ryv43sq08w6rp8g25hye7wmy38',
        proof_height: {
          revision_height: '6268541',
          revision_number: '3',
        },
        proof_unreceived:
          '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',
        next_sequence_recv: '76',
      };
      const attributes = [
        {
          key: 'packet_timeout_height',
          value: '3-6254585',
          event_id: 1,
        },
        {
          key: 'packet_timeout_timestamp',
          value: '1676722677558827165',
          event_id: 1,
        },
        {
          key: 'packet_sequence',
          value: '76',
          event_id: 1,
        },
        {
          key: 'packet_src_port',
          value: 'transfer',
          event_id: 1,
        },
        {
          key: 'packet_src_channel',
          value: 'channel-5',
          event_id: 1,
        },
        {
          key: 'packet_dst_port',
          value: 'transfer',
          event_id: 1,
        },
        {
          key: 'packet_dst_channel',
          value: 'channel-48',
          event_id: 1,
        },
        {
          key: 'packet_channel_ordering',
          value: 'ORDER_UNORDERED',
          event_id: 1,
        },
      ];
      const event = Event.fromJson({
        type: IbcMessage.EVENT_TYPE.TIMEOUT_PACKET,
        attributes,
        content,
        message_id: 1,
        tx_hash: this.transaction.hash,
      });
      await this.crawlIbcAppSerivce.handleIbcMessage([event], trx);
      const newPacket = await IbcMessage.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newPacket.src_channel_id).toEqual(attributes[4].value);
      expect(newPacket.src_port_id).toEqual(attributes[3].value);
      expect(newPacket.dst_port_id).toEqual(attributes[5].value);
      expect(newPacket.dst_channel_id).toEqual(attributes[6].value);
      expect(newPacket.type).toEqual(event.type);
      expect(newPacket.sequence).toEqual(parseInt(attributes[2].value, 10));
      expect(newPacket.data).toEqual(null);
      expect(newPacket.tx_hash).toEqual(this.transaction.hash);
      await trx.rollback();
    });
  }
}

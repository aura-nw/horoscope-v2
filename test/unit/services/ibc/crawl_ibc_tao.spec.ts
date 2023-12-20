import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import {
  Block,
  Event,
  IbcChannel,
  IbcClient,
  IbcConnection,
  Transaction,
} from '../../../../src/models';
import CrawlIbcTaoService from '../../../../src/services/ibc/crawl_ibc_tao.service';

@Describe('Test crawl ibc service')
export default class CrawlIbcTest {
  broker = new ServiceBroker({ logger: false });

  crawlIbcTaoSerivce = this.broker.createService(
    CrawlIbcTaoService
  ) as CrawlIbcTaoService;

  block: Block = Block.fromJson({
    height: 1300000,
    hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
    time: '2023-01-12T01:53:57.216Z',
    proposer_address: 'auraomd;cvpio3j4eg',
    data: {},
  });

  transaction: Transaction = Transaction.fromJson({
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
  });

  @BeforeAll()
  async initSuite() {
    this.crawlIbcTaoSerivce.getQueueManager().stopAll();
    await knex.raw(
      'TRUNCATE TABLE block, transaction, ibc_client RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test handleNewIbcClient')
  async testHandleNewIbcClient() {
    await knex.transaction(async (trx) => {
      const events = Event.fromJson({
        type: Event.EVENT_TYPE.CREATE_CLIENT,
        attributes: [
          {
            value: '07-tendermint-21',
            key: 'client_id',
            event_id: '1',
          },
          {
            value: '07-tendermint',
            key: 'client_type',
            event_id: '1',
          },
          {
            value: '3-5086858',
            key: 'consensus_height',
            event_id: '1',
          },
        ],
        content: {
          '@type': '/ibc.core.client.v1.MsgCreateClient',
          signer: 'aura1gypt2w7xg5t9yr76hx6zemwd4xv72jckk03r6t',
          client_state: {
            '@type': '/ibc.lightclients.tendermint.v1.ClientState',
            chain_id: 'axelar-testnet-lisbon-3',
            proof_specs: [
              {
                leaf_spec: {
                  hash: 'SHA256',
                  length: 'VAR_PROTO',
                  prefix: 'AA==',
                  prehash_key: 'NO_HASH',
                  prehash_value: 'SHA256',
                },
                max_depth: 0,
                min_depth: 0,
                inner_spec: {
                  hash: 'SHA256',
                  child_size: 33,
                  child_order: [0, 1],
                  empty_child: '',
                  max_prefix_length: 12,
                  min_prefix_length: 4,
                },
              },
              {
                leaf_spec: {
                  hash: 'SHA256',
                  length: 'VAR_PROTO',
                  prefix: 'AA==',
                  prehash_key: 'NO_HASH',
                  prehash_value: 'SHA256',
                },
                max_depth: 0,
                min_depth: 0,
                inner_spec: {
                  hash: 'SHA256',
                  child_size: 32,
                  child_order: [0, 1],
                  empty_child: '',
                  max_prefix_length: 1,
                  min_prefix_length: 1,
                },
              },
            ],
            trust_level: {
              numerator: '1',
              denominator: '3',
            },
            upgrade_path: ['upgrade', 'upgradedIBCState'],
            frozen_height: {
              revision_height: '0',
              revision_number: '0',
            },
            latest_height: {
              revision_height: '5086858',
              revision_number: '3',
            },
            max_clock_drift: '40000000000',
            trusting_period: '403200000000000',
            unbonding_period: '604800000000000',
            allow_update_after_expiry: true,
            allow_update_after_misbehaviour: true,
          },
          consensus_state: {
            root: {
              hash: '/iST1C+vhywD9qgGNqSQvs0NIPlQMqIDwgIJKMIylUI=',
            },
            '@type': '/ibc.lightclients.tendermint.v1.ConsensusState',
            timestamp: '2022-12-01T07:22:43.523Z',
            next_validators_hash:
              'RY9Nf/qtdDMVQK7LMjoVgrS1CkZaEVj02CDlkdgzutM=',
          },
        },
      });
      await this.crawlIbcTaoSerivce.handleNewIbcClient([events], trx);
      const newClient = await IbcClient.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newClient.client_id).toEqual(events.attributes[0].value);
      expect(newClient.client_type).toEqual(events.attributes[1].value);
      expect(newClient.client_state).toEqual(events.content.client_state);
      expect(newClient.consensus_state).toEqual(events.content.consensus_state);
      expect(newClient.counterparty_chain_id).toEqual(
        events.content.client_state.chain_id
      );
      // await trx.rollback();
    });
  }

  @Test('Test handleNewIbcConnection')
  async testHandleNewIbcConnection() {
    await knex.transaction(async (trx) => {
      const events = Event.fromJson({
        type: Event.EVENT_TYPE.CONNECTION_OPEN_ACK,
        attributes: [
          {
            value: 'connection-72',
            key: 'connection_id',
            event_id: '1',
          },
          {
            value: '07-tendermint-21',
            key: 'client_id',
            event_id: '1',
          },
          {
            value: '07-tendermint-45',
            key: 'counterparty_client_id',
            event_id: '1',
          },
          {
            value: 'connection-27',
            key: 'counterparty_connection_id',
            event_id: '1',
          },
        ],
        content: {
          '@type': '/ibc.core.connection.v1.MsgConnectionOpenAck',
          signer: 'aura1gypt2w7xg5t9yr76hx6zemwd4xv72jckk03r6t',
          version: {
            features: ['ORDER_ORDERED', 'ORDER_UNORDERED'],
            identifier: '1',
          },
          proof_try:
            'CsQICsEIChljb25uZWN0aW9ucy9jb25uZWN0aW9uLTI3EmMKEDA3LXRlbmRlcm1pbnQtNDUSIwoBMRINT1JERVJfT1JERVJFRBIPT1JERVJfVU5PUkRFUkVEGAIiKAoQMDctdGVuZGVybWludC04MBINY29ubmVjdGlvbi03MhoFCgNpYmMaDggBGAEgASoGAAKa8pYEIi4IARIHAgSa8pYEIBohIB/PBZ4uljQRWTUoJWTvlXAf+Sf3geF7LsWKI7+WpaUwIiwIARIoBAia8pYEIEIyNKRwbo7UewNW1Bg6gWp+7QriRoCvyv6ZbKjZHs9wICIsCAESKAYMmvKWBCCeMewQOVwuaeBrU7LaB5kuNW/4JAlZjbrMXHi+1d1mlSAiLAgBEigIGprylgQg3u9esjU846jXfzCL7RGmbCTrgcWgML7vMgDjjXy8LkUgIi4IARIHCiaa8pYEIBohIDGrQ5aJZsN6Ut9GQ3wNVnStZ8Dr7mrIPRFRG/Zv3Z5CIiwIARIoDDia8pYEIHbOF4x7UN1YqA+xoo7KL7w0/rXENvBouFTaVqaJPA7gICIsCAESKA5gmvKWBCA9QpxrAfbqqlM63etC3YtsbTzTJAWBnIGK430UOkRK2CAiLQgBEikQ0AGi8pYEICUsHnwDn1/px2K6DyMm9lISpOrK4TNSLLpbJKbmXp6OICItCAESKRKuA6LylgQgXH14FUNckJ7q6yDzHxVWwkawlgmkdaa9650oE2k2OjsgIi0IARIpFKYFovKWBCAkaa0OlC4pKo4m2xRQeVbx0tieLhfak6Xsu5QVp9cXCCAiLQgBEikWxAqi8pYEIIOT6BYqI5lA+xTBTIRO+dPHH+MnF/7FXoFVz1/cEdVoICItCAESKRj0D6LylgQgxiwkb7P1fNqTdZUSduYl+OfDeXURD69QiFtfjNelu5UgIi0IARIpGqodovKWBCAuUcxazpKF/ptiPz3WEHJuhQNHrYxXUohbInjviGhzCCAiLQgBEikc2F6i8pYEIGlpNHXMBW35F/0aor1DBEL5XBEKxhQigsCTP1pmNykLICIuCAESKh7YlAGi8pYEINa1ZObRgViKtwVE+LVx59w3/oF2pnB0sjlIYyPhwFu2ICIuCAESKiDY7AKi8pYEIPFQOkaEFsZuc5VCL3XLMvndPVA1pCpQVUqq1MAtCRxOICIuCAESKiLq7wWi8pYEIG+vkeRtqUosbXbXctdffMe0oJ0VwyLp+b6J21UuXLBOICIuCAESKibe5Rai8pYEIMdjCIRMYnQf4Nph+jj/sgQbJOO/p/fXqVBXy3hKUr7TICIwCAESCSr+mCai8pYEIBohIKJhx7HKM0nG82d3MAl9cguF5EaDS8VfAQ6E2jwPqc88Ii4IARIqLNiOQaLylgQgZGldPsQJXlzRlduhZIdTRH4SHfo5Xbh/ouka5hktIfcgCv4BCvsBCgNpYmMSIAD8TsE9shScVyP/CHb+hr1siAWPBMHaduu4dWdgj1rBGgkIARgBIAEqAQAiJwgBEgEBGiD5Vt5/BBmvQQnMGXTh8TcjCr0rjLn1J3de7MoaiBcPIiIlCAESIQEvzAtKPUXmsWa73ufs4PS4NzfxMUJ/f7tJz7zRzeuU8CInCAESAQEaIAeJGXGcGsRVvSn5H69yS0J+ru1UFKAa8tkcM2iQ3uOEIiUIARIhAWVN4MYZgTIpdDlaD9rFq8YDvzV9R+cVZEWff23oGt7iIicIARIBARogbDU0NT+iBtS39EPHJu5GTrbal9trUT5GhRdwLYLr+WQ=',
          client_state: {
            '@type': '/ibc.lightclients.tendermint.v1.ClientState',
            chain_id: 'euphoria-2',
            proof_specs: [
              {
                leaf_spec: {
                  hash: 'SHA256',
                  length: 'VAR_PROTO',
                  prefix: 'AA==',
                  prehash_key: 'NO_HASH',
                  prehash_value: 'SHA256',
                },
                max_depth: 0,
                min_depth: 0,
                inner_spec: {
                  hash: 'SHA256',
                  child_size: 33,
                  child_order: [0, 1],
                  empty_child: '',
                  max_prefix_length: 12,
                  min_prefix_length: 4,
                },
              },
              {
                leaf_spec: {
                  hash: 'SHA256',
                  length: 'VAR_PROTO',
                  prefix: 'AA==',
                  prehash_key: 'NO_HASH',
                  prehash_value: 'SHA256',
                },
                max_depth: 0,
                min_depth: 0,
                inner_spec: {
                  hash: 'SHA256',
                  child_size: 32,
                  child_order: [0, 1],
                  empty_child: '',
                  max_prefix_length: 1,
                  min_prefix_length: 1,
                },
              },
            ],
            trust_level: {
              numerator: '1',
              denominator: '3',
            },
            upgrade_path: ['upgrade', 'upgradedIBCState'],
            frozen_height: {
              revision_height: '0',
              revision_number: '0',
            },
            latest_height: {
              revision_height: '5744576',
              revision_number: '2',
            },
            max_clock_drift: '20000000000',
            trusting_period: '115200000000000',
            unbonding_period: '172800000000000',
            allow_update_after_expiry: true,
            allow_update_after_misbehaviour: true,
          },
          proof_client:
            'CqMJCqAJCiRjbGllbnRzLzA3LXRlbmRlcm1pbnQtNDUvY2xpZW50U3RhdGUSsgEKKy9pYmMubGlnaHRjbGllbnRzLnRlbmRlcm1pbnQudjEuQ2xpZW50U3RhdGUSggEKCmV1cGhvcmlhLTISBAgBEAMaBAiAhAciBAiAxgoqAggUMgA6BwgCEMDP3gJCGQoJCAEYASABKgEAEgwKAgABECEYBCAMMAFCGQoJCAEYASABKgEAEgwKAgABECAYASABMAFKB3VwZ3JhZGVKEHVwZ3JhZGVkSUJDU3RhdGVQAVgBGg4IARgBIAEqBgACovKWBCIuCAESBwIEovKWBCAaISBAlbewzvl2PjgUtyznqYRFOiNhxJp+KAq2YmJaxmAAsiIsCAESKAQGovKWBCDjWwUrygy8PnWb8yoN4Xwomockb9eYporo/dYJRHBDziAiLAgBEigGDqLylgQgjCxek5E7g4E/jZ/z9ayx2Rz8Wlwd5SourZeBm+l7ORkgIiwIARIoCByi8pYEIBzZYxppGpUUOli49o63SLSJv24Pv0bfhHrQL4/b7xR9ICIuCAESBwo0ovKWBCAaISCDdwKGH9QJ5iwCx763LCpf7/QE2iVdkRd52M3o9zDyOSIuCAESBwxGovKWBCAaISDhzb/9iqmZ90/la2ecG8xfrP1g49sNRKF7eHRoZ41hQyIsCAESKA5wovKWBCBbVdBjKBpebgwZFVLIitdMRdO0N0BkfjDLFp9EJMqrNCAiLwgBEggQ0AGi8pYEIBohIJfTNDSJ0SRz/JI1ivIeLCdm3ejk0yl2A7EwNe9AfAYZIi0IARIpEq4DovKWBCBcfXgVQ1yQnurrIPMfFVbCRrCWCaR1pr3rnSgTaTY6OyAiLQgBEikUpgWi8pYEICRprQ6ULikqjibbFFB5VvHS2J4uF9qTpey7lBWn1xcIICItCAESKRbECqLylgQgg5PoFiojmUD7FMFMhE7508cf4ycX/sVegVXPX9wR1WggIi0IARIpGPQPovKWBCDGLCRvs/V82pN1lRJ25iX458N5dREPr1CIW1+M16W7lSAiLQgBEikaqh2i8pYEIC5RzFrOkoX+m2I/PdYQcm6FA0etjFdSiFsieO+IaHMIICItCAESKRzYXqLylgQgaWk0dcwFbfkX/RqivUMEQvlcEQrGFCKCwJM/WmY3KQsgIi4IARIqHtiUAaLylgQg1rVk5tGBWIq3BUT4tXHn3Df+gXamcHSyOUhjI+HAW7YgIi4IARIqINjsAqLylgQg8VA6RoQWxm5zlUIvdcsy+d09UDWkKlBVSqrUwC0JHE4gIi4IARIqIurvBaLylgQgb6+R5G2pSixtdtdy1198x7SgnRXDIun5vonbVS5csE4gIi4IARIqJt7lFqLylgQgx2MIhExidB/g2mH6OP+yBBsk47+n99epUFfLeEpSvtMgIjAIARIJKv6YJqLylgQgGiEgomHHscozScbzZ3cwCX1yC4XkRoNLxV8BDoTaPA+pzzwiLggBEios2I5BovKWBCBkaV0+xAleXNGV26Fkh1NEfhId+jlduH+i6RrmGS0h9yAK/gEK+wEKA2liYxIgAPxOwT2yFJxXI/8Idv6GvWyIBY8Ewdp267h1Z2CPWsEaCQgBGAEgASoBACInCAESAQEaIPlW3n8EGa9BCcwZdOHxNyMKvSuMufUnd17syhqIFw8iIiUIARIhAS/MC0o9ReaxZrve5+zg9Lg3N/ExQn9/u0nPvNHN65TwIicIARIBARogB4kZcZwaxFW9Kfkfr3JLQn6u7VQUoBry2RwzaJDe44QiJQgBEiEBZU3gxhmBMil0OVoP2sWrxgO/NX1H5xVkRZ9/bega3uIiJwgBEgEBGiBsNTQ1P6IG1Lf0Q8cm7kZOttqX22tRPkaFF3Atguv5ZA==',
          proof_height: {
            revision_height: '4381842',
            revision_number: '0',
          },
          connection_id: 'connection-72',
          proof_consensus:
            'CtUICtIICjJjbGllbnRzLzA3LXRlbmRlcm1pbnQtNDUvY29uc2Vuc3VzU3RhdGVzLzItNTc0NDU3NhKGAQouL2liYy5saWdodGNsaWVudHMudGVuZGVybWludC52MS5Db25zZW5zdXNTdGF0ZRJUCgwIn4D+pQYQ9PKBuAMSIgogtPl77yi9LvzW1gkeO+teMVcM1E6qcv7Xp3okSVvtGAcaIMe9/GKdHdD4dPFEauon+h3QEdH1oZ6jP4DEH2ZWn3ROGg4IARgBIAEqBgACovKWBCIsCAESKAQGovKWBCAHjrwjqZJaxGGLEXaH55ia064+0SLWxo3XLQqnH3PnDSAiLAgBEigGDqLylgQgWMaksHVViO8rzGDk6rbntj3jGE+rHofgIGu7zk8ojukgIi4IARIHCBii8pYEIBohIJgUvjsUDyjaulIls+YyOVYO793IQ59F4DtEoCEKLZTfIiwIARIoCjSi8pYEIEzSRrihNkes+Q5IuNa5gpyhkva9yby1DMC1p8VrYlUUICIuCAESBwxGovKWBCAaISDhzb/9iqmZ90/la2ecG8xfrP1g49sNRKF7eHRoZ41hQyIsCAESKA5wovKWBCBbVdBjKBpebgwZFVLIitdMRdO0N0BkfjDLFp9EJMqrNCAiLwgBEggQ0AGi8pYEIBohIJfTNDSJ0SRz/JI1ivIeLCdm3ejk0yl2A7EwNe9AfAYZIi0IARIpEq4DovKWBCBcfXgVQ1yQnurrIPMfFVbCRrCWCaR1pr3rnSgTaTY6OyAiLQgBEikUpgWi8pYEICRprQ6ULikqjibbFFB5VvHS2J4uF9qTpey7lBWn1xcIICItCAESKRbECqLylgQgg5PoFiojmUD7FMFMhE7508cf4ycX/sVegVXPX9wR1WggIi0IARIpGPQPovKWBCDGLCRvs/V82pN1lRJ25iX458N5dREPr1CIW1+M16W7lSAiLQgBEikaqh2i8pYEIC5RzFrOkoX+m2I/PdYQcm6FA0etjFdSiFsieO+IaHMIICItCAESKRzYXqLylgQgaWk0dcwFbfkX/RqivUMEQvlcEQrGFCKCwJM/WmY3KQsgIi4IARIqHtiUAaLylgQg1rVk5tGBWIq3BUT4tXHn3Df+gXamcHSyOUhjI+HAW7YgIi4IARIqINjsAqLylgQg8VA6RoQWxm5zlUIvdcsy+d09UDWkKlBVSqrUwC0JHE4gIi4IARIqIurvBaLylgQgb6+R5G2pSixtdtdy1198x7SgnRXDIun5vonbVS5csE4gIi4IARIqJt7lFqLylgQgx2MIhExidB/g2mH6OP+yBBsk47+n99epUFfLeEpSvtMgIjAIARIJKv6YJqLylgQgGiEgomHHscozScbzZ3cwCX1yC4XkRoNLxV8BDoTaPA+pzzwiLggBEios2I5BovKWBCBkaV0+xAleXNGV26Fkh1NEfhId+jlduH+i6RrmGS0h9yAK/gEK+wEKA2liYxIgAPxOwT2yFJxXI/8Idv6GvWyIBY8Ewdp267h1Z2CPWsEaCQgBGAEgASoBACInCAESAQEaIPlW3n8EGa9BCcwZdOHxNyMKvSuMufUnd17syhqIFw8iIiUIARIhAS/MC0o9ReaxZrve5+zg9Lg3N/ExQn9/u0nPvNHN65TwIicIARIBARogB4kZcZwaxFW9Kfkfr3JLQn6u7VQUoBry2RwzaJDe44QiJQgBEiEBZU3gxhmBMil0OVoP2sWrxgO/NX1H5xVkRZ9/bega3uIiJwgBEgEBGiBsNTQ1P6IG1Lf0Q8cm7kZOttqX22tRPkaFF3Atguv5ZA==',
          consensus_height: {
            revision_height: '5744576',
            revision_number: '2',
          },
          counterparty_connection_id: 'connection-27',
        },
      });
      await this.crawlIbcTaoSerivce.handleNewIbcConnection([events], trx);
      const newConnection = await IbcConnection.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newConnection.connection_id).toEqual(events.attributes[0].value);
      expect(newConnection.counterparty_client_id).toEqual(
        events.attributes[2].value
      );
      expect(newConnection.counterparty_connection_id).toEqual(
        events.attributes[3].value
      );
    });
  }

  @Test('Test handleNewIbcChannel')
  async testHandleNewIbcChannel() {
    await knex.transaction(async (trx) => {
      const events = Event.fromJson({
        type: Event.EVENT_TYPE.CHANNEL_OPEN_ACK,
        attributes: [
          {
            value:
              'wasm.aura1s42mq5xz5et3fhs0cxvf8ds6vmy5u6d27u23ydq28r2hgmednw5s3u7kjf',
            key: 'port_id',
            event_id: '1',
          },
          {
            value: 'channel-79',
            key: 'channel_id',
            event_id: '1',
          },
          {
            value:
              'wasm.nois1xwde9rzqk5u36fke0r9ddmtwvh43n4fv53c5vc462wz8xlnqjhls6d90xc',
            key: 'counterparty_port_id',
            event_id: '1',
          },
          {
            value: 'channel-44',
            key: 'counterparty_channel_id',
            event_id: '1',
          },
          {
            value: 'connection-72',
            key: 'connection_id',
            event_id: '1',
          },
        ],
        content: {
          '@type': '/ibc.core.channel.v1.MsgChannelOpenAck',
          signer: 'aura1teguu4gyk002q74rdw8xk6wxz663d3e0da44vv',
          port_id:
            'wasm.aura1s42mq5xz5et3fhs0cxvf8ds6vmy5u6d27u23ydq28r2hgmednw5s3u7kjf',
          proof_try:
            'CqsJCqgJCmpjaGFubmVsRW5kcy9wb3J0cy93YXNtLm5vaXMxeHdkZTlyenFrNXUzNmZrZTByOWRkbXR3dmg0M240ZnY1M2M1dmM0NjJ3ejh4bG5xamhsczZkOTB4Yy9jaGFubmVscy9jaGFubmVsLTQ0EnAIAhABGlIKRHdhc20uYXVyYTFzNDJtcTV4ejVldDNmaHMwY3h2ZjhkczZ2bXk1dTZkMjd1MjN5ZHEyOHIyaGdtZWRudzVzM3U3a2pmEgpjaGFubmVsLTc5Ig1jb25uZWN0aW9uLTIwKgdub2lzLXY3Gg4IARgBIAEqBgACqNbwAyIsCAESKAIEqNbwAyApVTv4ZHdG03r0dv2FLRgljarFXhPCzLxe5U794Dxg7iAiLAgBEigEBqjW8AMgbTQCakVAjVARrysKAAPM1e1tiTHofZa81TN6VdrZryMgIiwIARIoBgqo1vADIH+PzOA8CN5w3mj/yRWJffIKzoh1l9E7sKZ5XNBpk36XICIuCAESBwgQqNbwAyAaISDJYlIFbAyC1KK1ZZBsZZFdBLoWBTAPcvdp1IOv5E9HLSIuCAESBwowqNbwAyAaISCEaKaAA8yFOHGODccYN+9HuImlZxYWqoTxIN/J8kBiayIsCAESKAxUqNbwAyD3SAJRP1mO4LVWbHvRyD2webWn9TkNbkJZy7jIPzhrMiAiLwgBEggO1AGo1vADIBohICKuXv3N+wd3GBXhJZ27wd4v6vIL8XZUP8OoZE/aOUysIi0IARIpEO4CqNbwAyBgaG7cgNsElUcgrf9Mp2Gmzo0/AsmRHPw5FTwX9Kr0MSAiLQgBEikSqASo1vADIFQDyXDfKzS3OL1ZkYfELpPLhFtz8T5WII7GUvojwrwsICItCAESKRScBqjW8AMgfo0r4iAG6Q26x4Y6zuXHZJc5TgywPhYCp408vX7zDBQgIi0IARIpFtIMqNbwAyDqu2q/0ILlZYXdrphZJmwZtcf8/aHxsqR3dX84m9TTeiAiLQgBEikYgBqo1vADIIPtczfmGBBRreb3CDJB7Wm0ebRH+HR88bBCcXaUupjcICIvCAESCBrAJ6jW8AMgGiEgcpa1SruIq6LeCV4xG7rX2arPRTP/iEbXQ8D5WnWUzwAiLwgBEggc1mGo1vADIBohIDXxpaT6Ugv6U6oOS5S0EDChcoYZW0+my6CUTsXNzvvGIi4IARIqHoqRAajW8AMgBRWQCNEouEeVb1Jgy9Tt+qq891z0wHVNBzVj20RLaGggIi4IARIqItjHAqjW8AMgUvOkgI+dIkIugdSRweG9eleBh/pswvTETxdw6FY4uTwgIjAIARIJJPDCDajW8AMgGiEgyhYnMC8oHxxof8aeyKInF9dJIbxw7e5YkEFV7dhRRWMiLggBEiom8rYSqNbwAyD0JrFmOhwOvx0p9bY869JVWAT2YOnKOMAZ2aBBy0VO/CAiLggBEioosvQZqNbwAyCz9+zU1Wu3buyW7azM+yVxZPfqMxKFHWdwLoOIS5JhYyAiMAgBEgkq9oM/qNbwAyAaISAPNNwvlr7Cghq7eoYfeWqJEKPOMwjXnB66fWb3O1uckQr+AQr7AQoDaWJjEiDfSyEEYUNHoexjzxEoS8ca//0GRWkbX/BhVhlfyDT5zBoJCAEYASABKgEAIicIARIBARog+VbefwQZr0EJzBl04fE3Iwq9K4y59Sd3XuzKGogXDyIiJQgBEiEBL8wLSj1F5rFmu97n7OD0uDc38TFCf3+7Sc+80c3rlPAiJwgBEgEBGiDFznslp7K5oVZJG04oLeQXNU3ws7wFeEH4qB+XS4Q9zyIlCAESIQEtpn507xvLNnr4cRXICIMm+qvT86qeswagi/7S7aB1riInCAESAQEaILASAaS4z/TvmnniGlkXMUOeTYKHWs4RWU6MlCMFBTA3',
          channel_id: 'channel-79',
          proof_height: {
            revision_height: '4068757',
            revision_number: '0',
          },
          counterparty_version: 'nois-v7',
          counterparty_channel_id: 'channel-44',
        },
      });
      await this.crawlIbcTaoSerivce.handleNewIbcChannel([events], trx);
      const newChannel = await IbcChannel.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newChannel.channel_id).toEqual(events.attributes[1].value);
      expect(newChannel.counterparty_channel_id).toEqual(
        events.attributes[3].value
      );
      expect(newChannel.counterparty_port_id).toEqual(
        events.attributes[2].value
      );
      expect(newChannel.port_id).toEqual(events.attributes[0].value);
      expect(newChannel.state).toEqual(IbcChannel.STATUS.OPEN);
    });
  }

  @Test('Test handleCloseIbcChannel')
  async testHandleCloseIbcChannel() {
    await knex.transaction(async (trx) => {
      const events = Event.fromJson({
        type: Event.EVENT_TYPE.CHANNEL_CLOSE_CONFIRM,
        attributes: [
          {
            value:
              'wasm.aura1s42mq5xz5et3fhs0cxvf8ds6vmy5u6d27u23ydq28r2hgmednw5s3u7kjf',
            key: 'port_id',
            event_id: '1',
          },
          {
            value: 'channel-79',
            key: 'channel_id',
            event_id: '1',
          },
          {
            value:
              'wasm.nois1xwde9rzqk5u36fke0r9ddmtwvh43n4fv53c5vc462wz8xlnqjhls6d90xc',
            key: 'counterparty_port_id',
            event_id: '1',
          },
          {
            value: 'channel-44',
            key: 'counterparty_channel_id',
            event_id: '1',
          },
          {
            value: 'connection-72',
            key: 'connection_id',
            event_id: '1',
          },
        ],
        content: {
          '@type': '/ibc.core.channel.v1.MsgChannelOpenAck',
          signer: 'aura1teguu4gyk002q74rdw8xk6wxz663d3e0da44vv',
          port_id:
            'wasm.aura1s42mq5xz5et3fhs0cxvf8ds6vmy5u6d27u23ydq28r2hgmednw5s3u7kjf',
          proof_try:
            'CqsJCqgJCmpjaGFubmVsRW5kcy9wb3J0cy93YXNtLm5vaXMxeHdkZTlyenFrNXUzNmZrZTByOWRkbXR3dmg0M240ZnY1M2M1dmM0NjJ3ejh4bG5xamhsczZkOTB4Yy9jaGFubmVscy9jaGFubmVsLTQ0EnAIAhABGlIKRHdhc20uYXVyYTFzNDJtcTV4ejVldDNmaHMwY3h2ZjhkczZ2bXk1dTZkMjd1MjN5ZHEyOHIyaGdtZWRudzVzM3U3a2pmEgpjaGFubmVsLTc5Ig1jb25uZWN0aW9uLTIwKgdub2lzLXY3Gg4IARgBIAEqBgACqNbwAyIsCAESKAIEqNbwAyApVTv4ZHdG03r0dv2FLRgljarFXhPCzLxe5U794Dxg7iAiLAgBEigEBqjW8AMgbTQCakVAjVARrysKAAPM1e1tiTHofZa81TN6VdrZryMgIiwIARIoBgqo1vADIH+PzOA8CN5w3mj/yRWJffIKzoh1l9E7sKZ5XNBpk36XICIuCAESBwgQqNbwAyAaISDJYlIFbAyC1KK1ZZBsZZFdBLoWBTAPcvdp1IOv5E9HLSIuCAESBwowqNbwAyAaISCEaKaAA8yFOHGODccYN+9HuImlZxYWqoTxIN/J8kBiayIsCAESKAxUqNbwAyD3SAJRP1mO4LVWbHvRyD2webWn9TkNbkJZy7jIPzhrMiAiLwgBEggO1AGo1vADIBohICKuXv3N+wd3GBXhJZ27wd4v6vIL8XZUP8OoZE/aOUysIi0IARIpEO4CqNbwAyBgaG7cgNsElUcgrf9Mp2Gmzo0/AsmRHPw5FTwX9Kr0MSAiLQgBEikSqASo1vADIFQDyXDfKzS3OL1ZkYfELpPLhFtz8T5WII7GUvojwrwsICItCAESKRScBqjW8AMgfo0r4iAG6Q26x4Y6zuXHZJc5TgywPhYCp408vX7zDBQgIi0IARIpFtIMqNbwAyDqu2q/0ILlZYXdrphZJmwZtcf8/aHxsqR3dX84m9TTeiAiLQgBEikYgBqo1vADIIPtczfmGBBRreb3CDJB7Wm0ebRH+HR88bBCcXaUupjcICIvCAESCBrAJ6jW8AMgGiEgcpa1SruIq6LeCV4xG7rX2arPRTP/iEbXQ8D5WnWUzwAiLwgBEggc1mGo1vADIBohIDXxpaT6Ugv6U6oOS5S0EDChcoYZW0+my6CUTsXNzvvGIi4IARIqHoqRAajW8AMgBRWQCNEouEeVb1Jgy9Tt+qq891z0wHVNBzVj20RLaGggIi4IARIqItjHAqjW8AMgUvOkgI+dIkIugdSRweG9eleBh/pswvTETxdw6FY4uTwgIjAIARIJJPDCDajW8AMgGiEgyhYnMC8oHxxof8aeyKInF9dJIbxw7e5YkEFV7dhRRWMiLggBEiom8rYSqNbwAyD0JrFmOhwOvx0p9bY869JVWAT2YOnKOMAZ2aBBy0VO/CAiLggBEioosvQZqNbwAyCz9+zU1Wu3buyW7azM+yVxZPfqMxKFHWdwLoOIS5JhYyAiMAgBEgkq9oM/qNbwAyAaISAPNNwvlr7Cghq7eoYfeWqJEKPOMwjXnB66fWb3O1uckQr+AQr7AQoDaWJjEiDfSyEEYUNHoexjzxEoS8ca//0GRWkbX/BhVhlfyDT5zBoJCAEYASABKgEAIicIARIBARog+VbefwQZr0EJzBl04fE3Iwq9K4y59Sd3XuzKGogXDyIiJQgBEiEBL8wLSj1F5rFmu97n7OD0uDc38TFCf3+7Sc+80c3rlPAiJwgBEgEBGiDFznslp7K5oVZJG04oLeQXNU3ws7wFeEH4qB+XS4Q9zyIlCAESIQEtpn507xvLNnr4cRXICIMm+qvT86qeswagi/7S7aB1riInCAESAQEaILASAaS4z/TvmnniGlkXMUOeTYKHWs4RWU6MlCMFBTA3',
          channel_id: 'channel-79',
          proof_height: {
            revision_height: '4068757',
            revision_number: '0',
          },
          counterparty_version: 'nois-v7',
          counterparty_channel_id: 'channel-44',
        },
      });
      await this.crawlIbcTaoSerivce.handleCloseIbcChannel([events], trx);
      const newChannel = await IbcChannel.query()
        .transacting(trx)
        .first()
        .throwIfNotFound();
      expect(newChannel.state).toEqual(IbcChannel.STATUS.CLOSE);
    });
  }
}

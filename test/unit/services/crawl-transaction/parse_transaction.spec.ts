/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { AfterEach, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Log } from '@cosmjs/stargate/build/logs';
import { Attribute, Event } from '@cosmjs/stargate/build/events';
import {
  Transaction,
  Event as EventModel,
  Block,
} from '../../../../src/models';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import knex from '../../../../src/common/utils/db_connection';
import tx_fixture from './tx.fixture.json' assert { type: 'json' };
import tx_fixture_authz from './tx_authz.fixture.json' assert { type: 'json' };
import ChainRegistry from '../../../../src/common/utils/chain.registry';
import { getProviderRegistry } from '../../../../src/common/utils/provider.registry';

@Describe('Test crawl transaction service')
export default class CrawlTransactionTest {
  broker = new ServiceBroker({ logger: false });

  crawlTxService?: CrawlTxService;

  @BeforeEach()
  async initSuite() {
    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;
    this.crawlTxService?.getQueueManager().stopAll();
    await Promise.all([
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
    ]);
    const providerRegistry = await getProviderRegistry();
    const chainRegistry = new ChainRegistry(
      this.crawlTxService.logger,
      providerRegistry
    );
    chainRegistry.setCosmosSdkVersionByString('v0.45.7');
    this.crawlTxService.setRegistry(chainRegistry);
  }

  @Test('Parse transaction and insert to DB')
  public async testHandleTransaction() {
    await Block.query().insert(
      Block.fromJson({
        height: 423136,
        hash: 'data hash',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );

    const listdecodedTx = await this.crawlTxService?.decodeListRawTx([
      {
        listTx: { ...tx_fixture },
        height: 423136,
        timestamp: '2023-04-17T03:44:41.000Z',
      },
    ]);
    if (listdecodedTx)
      await knex.transaction(async (trx) => {
        await this.crawlTxService?.insertDecodedTxAndRelated(
          listdecodedTx,
          trx
        );
      });

    const tx = await Transaction.query().findOne(
      'hash',
      '5F38B0C3E9FAB4423C37FB6306AC06D983AF50013BC7BCFBD9F684D6BFB0AF23'
    );
    expect(tx).not.toBeUndefined();
    if (tx) {
      const logs = JSON.parse(tx_fixture.txs[0].tx_result.log);
      const eventAttributes = await EventModel.query()
        .select(
          'attributes.composite_key',
          'attributes.value',
          'event.tx_msg_index'
        )
        .joinRelated('attributes')
        .where('event.tx_id', tx.id);

      logs.forEach((log: Log) => {
        const msgIndex = log.msg_index ?? 0;
        log.events.forEach((event: Event) => {
          event.attributes.forEach((attribute: Attribute) => {
            const found = eventAttributes.find(
              (item) =>
                item.composite_key === `${event.type}.${attribute.key}` &&
                item.value === attribute.value &&
                item.tx_msg_index === msgIndex
            );

            expect(found).not.toBeUndefined();
          });
        });
      });
    }
  }

  @Test('Parse transaction authz and insert to DB')
  public async testHandleTransactionAuthz() {
    await Block.query().insert(
      Block.fromJson({
        height: 452049,
        hash: 'data hash authz',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );
    const listdecodedTx = await this.crawlTxService?.decodeListRawTx([
      {
        listTx: { ...tx_fixture_authz },
        height: 452049,
        timestamp: '2023-04-17T03:44:41.000Z',
      },
    ]);
    if (listdecodedTx)
      await knex.transaction(async (trx) => {
        await this.crawlTxService?.insertDecodedTxAndRelated(
          listdecodedTx,
          trx
        );
      });
    const tx = await Transaction.query().findOne(
      'hash',
      '14B177CFD3AC22F6AF1B46EF24C376B757B2379023E9EE075CB81A5E2FF18FAC'
    );
    expect(tx).not.toBeUndefined();
    if (tx) {
      const logs = JSON.parse(tx_fixture_authz.txs[0].tx_result.log);
      const eventAttributes = await EventModel.query()
        .select(
          'attributes.composite_key',
          'attributes.value',
          'event.tx_msg_index'
        )
        .joinRelated('attributes')
        .where('event.tx_id', tx.id);

      logs.forEach((log: Log) => {
        const msgIndex = log.msg_index ?? 0;
        log.events.forEach((event: Event) => {
          event.attributes.forEach((attribute: Attribute) => {
            const found = eventAttributes.find(
              (item) =>
                item.composite_key === `${event.type}.${attribute.key}` &&
                item.value === attribute.value &&
                item.tx_msg_index === msgIndex
            );
            expect(found).not.toBeUndefined();
          });
        });
      });
    }
    // }
    // );
  }

  arrDest = {
    index: 3,
    type: 'coin_received',
    attributes: [
      { key: 'receiver', value: 'aura162x2llsxzxmavtyuxjesceewmy4wvrp79ndcrw' },
      { key: 'amount', value: '1341uaura' },
      { key: 'authz_msg_index', value: '0' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '909uaura' },
      { key: 'authz_msg_index', value: '0' },
      { key: 'receiver', value: 'aura1ujv2gmfwrwzj504ntggqld0q5euafp76vgx5lj' },
      { key: 'amount', value: '154uaura' },
      { key: 'authz_msg_index', value: '1' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '104uaura' },
      { key: 'authz_msg_index', value: '1' },
      { key: 'receiver', value: 'aura177cgzmjve5m0je6yjukcj4mmmwj8p4dkqekglz' },
      { key: 'amount', value: '4511uaura' },
      { key: 'authz_msg_index', value: '2' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '3056uaura' },
      { key: 'authz_msg_index', value: '2' },
      { key: 'receiver', value: 'aura1rqll2d4wyylvl03ht6mhglswj46gkcr3ksvkm7' },
      { key: 'amount', value: '3617uaura' },
      { key: 'authz_msg_index', value: '3' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '2451uaura' },
      { key: 'authz_msg_index', value: '3' },
      { key: 'receiver', value: 'aura1a6x0znjhztz73tq07gjvzt9ru99866jm665w9p' },
      { key: 'amount', value: '5417uaura' },
      { key: 'authz_msg_index', value: '4' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '3670uaura' },
      { key: 'authz_msg_index', value: '4' },
      { key: 'receiver', value: 'aura1q93xkwtfv7nut0eqjjws377wkjk97265zsxlx6' },
      { key: 'amount', value: '30uaura' },
      { key: 'authz_msg_index', value: '5' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '20uaura' },
      { key: 'authz_msg_index', value: '5' },
      { key: 'receiver', value: 'aura1xk6nnn0gen9n9fduz0t3twyzt8c2uzedy2545a' },
      { key: 'amount', value: '2797uaura' },
      { key: 'authz_msg_index', value: '6' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '1895uaura' },
      { key: 'authz_msg_index', value: '6' },
      { key: 'receiver', value: 'aura1f3qxww8pnx0xrea7e03ffxnlau0fk5ufs3v0zj' },
      { key: 'amount', value: '2457uaura' },
      { key: 'authz_msg_index', value: '7' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '1665uaura' },
      { key: 'authz_msg_index', value: '7' },
      { key: 'receiver', value: 'aura1fwtkqe4yp652svrj5lzdu9lnykysh947msc4xq' },
      { key: 'amount', value: '2589uaura' },
      { key: 'authz_msg_index', value: '8' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '1754uaura' },
      { key: 'authz_msg_index', value: '8' },
      { key: 'receiver', value: 'aura1j6kwc05lw0p8e08ce3r5z5qlygjzu0aq095scc' },
      { key: 'amount', value: '212uaura' },
      { key: 'authz_msg_index', value: '9' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '143uaura' },
      { key: 'authz_msg_index', value: '9' },
      { key: 'receiver', value: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5' },
      { key: 'amount', value: '1689uaura' },
      { key: 'authz_msg_index', value: '10' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '1144uaura' },
      { key: 'authz_msg_index', value: '10' },
      { key: 'receiver', value: 'aura1efq5q4uzn583nh5mauzc5cmgms53w9l6vs5dxz' },
      { key: 'amount', value: '105uaura' },
      { key: 'authz_msg_index', value: '11' },
      { key: 'receiver', value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw' },
      { key: 'amount', value: '71uaura' },
      { key: 'authz_msg_index', value: '11' },
    ],
  };

  arrSrc: any[] = [
    {
      // this event not has checkedIndex because its belong to tx event
      type: 'coin_received',
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==',
        },
        { key: 'YW1vdW50', value: 'ODk2dWF1cmE=' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTE2MngybGxzeHp4bWF2dHl1eGplc2NlZXdteTR3dnJwNzluZGNydw==',
        },
        { key: 'YW1vdW50', value: 'MTM0MXVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MA==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'OTA5dWF1cmE=' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MA==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTF1anYyZ21md3J3emo1MDRudGdncWxkMHE1ZXVhZnA3NnZneDVsag==',
        },
        { key: 'YW1vdW50', value: 'MTU0dWF1cmE=' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MQ==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MTA0dWF1cmE=' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MQ==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTE3N2Nnem1qdmU1bTBqZTZ5anVrY2o0bW1td2o4cDRka3Fla2dseg==',
        },
        { key: 'YW1vdW50', value: 'NDUxMXVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Mg==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MzA1NnVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Mg==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFycWxsMmQ0d3l5bHZsMDNodDZtaGdsc3dqNDZna2NyM2tzdmttNw==',
        },
        { key: 'YW1vdW50', value: 'MzYxN3VhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Mw==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MjQ1MXVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Mw==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFhNngwem5qaHp0ejczdHEwN2dqdnp0OXJ1OTk4NjZqbTY2NXc5cA==',
        },
        { key: 'YW1vdW50', value: 'NTQxN3VhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'NA==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MzY3MHVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'NA==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFxOTN4a3d0ZnY3bnV0MGVxamp3czM3N3drams5NzI2NXpzeGx4Ng==',
        },
        { key: 'YW1vdW50', value: 'MzB1YXVyYQ==' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'NQ==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MjB1YXVyYQ==' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'NQ==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTF4azZubm4wZ2VuOW45ZmR1ejB0M3R3eXp0OGMydXplZHkyNTQ1YQ==',
        },
        { key: 'YW1vdW50', value: 'Mjc5N3VhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Ng==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MTg5NXVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Ng==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmM3F4d3c4cG54MHhyZWE3ZTAzZmZ4bmxhdTBmazV1ZnMzdjB6ag==',
        },
        { key: 'YW1vdW50', value: 'MjQ1N3VhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Nw==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MTY2NXVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'Nw==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmd3RrcWU0eXA2NTJzdnJqNWx6ZHU5bG55a3lzaDk0N21zYzR4cQ==',
        },
        { key: 'YW1vdW50', value: 'MjU4OXVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'OA==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MTc1NHVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'OA==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFqNmt3YzA1bHcwcDhlMDhjZTNyNXo1cWx5Z2p6dTBhcTA5NXNjYw==',
        },
        { key: 'YW1vdW50', value: 'MjEydWF1cmE=' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'OQ==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MTQzdWF1cmE=' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'OQ==' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTE1ZjZ3bjNueW1kbmhuaDVkZGxxbGV0dXB0amFnMDl0cnlydHBxNQ==',
        },
        { key: 'YW1vdW50', value: 'MTY4OXVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MTA=' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'MTE0NHVhdXJh' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MTA=' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFlZnE1cTR1em41ODNuaDVtYXV6YzVjbWdtczUzdzlsNnZzNWR4eg==',
        },
        { key: 'YW1vdW50', value: 'MTA1dWF1cmE=' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MTE=' },
      ],
    },
    {
      type: 'coin_received',
      checkedIndex: 3,
      attributes: [
        {
          key: 'cmVjZWl2ZXI=',
          value: 'YXVyYTFmbDQ4dnNubXNkemN2ODVxNWQycTR6NWFqZGhhOHl1M3dkN2Rtdw==',
        },
        { key: 'YW1vdW50', value: 'NzF1YXVyYQ==' },
        { key: 'YXV0aHpfbXNnX2luZGV4', value: 'MTE=' },
      ],
    },
  ];

  @AfterEach()
  async tearDown() {
    this.crawlTxService?.getQueueManager().stopAll();
    await Promise.all([
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
      this.crawlTxService?._stop(),
      this.broker.stop(),
    ]);
  }
}

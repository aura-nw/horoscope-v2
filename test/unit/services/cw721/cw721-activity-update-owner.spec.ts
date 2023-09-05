import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CW721Contract from '../../../../src/models/cw721_contract';
import { Code } from '../../../../src/models';
import Cw721ActivityUpdateOwnerService from '../../../../src/services/cw721/cw721-activity-update-owner.service';
import CW721Activity from '../../../../src/models/cw721_tx';
import { CW721_ACTION } from '../../../../src/services/cw721/cw721.service';

@Describe('Test Cw721ActivityUpdateOwnerService')
export default class Cw721ActivityUpdateOwnerTest {
  codeId = {
    ...Code.fromJson({
      creator: 'code_id_creator',
      code_id: 100,
      data_hash: 'code_id_data_hash',
      instantiate_permission: { permission: '', address: '', addresses: [] },
      store_hash: 'code_id_store_hash',
      store_height: 1000,
      type: 'CW721',
    }),
    contracts: [
      {
        name: 'Base Contract 2',
        address: 'mock_contract_address',
        creator: 'phamphong_creator',
        code_id: 100,
        instantiate_hash: 'abc',
        instantiate_height: 300000,
      },
    ],
  };

  cw721Contract = {
    ...CW721Contract.fromJson({
      contract_id: 1,
      symbol: '',
      name: 'jghdfgkjdfgjk',
      track: true,
    }),
    tokens: [
      {
        token_id: 'bhlvjdfkljkljg',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 122120,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'zzzvcxxb',
        owner: 'xctgxgvxcgxx',
        last_updated_height: 155,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vbmnnmn',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 42424,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vcgasdfsdg',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 121012,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'cbvcxbvcxgbdv',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 651651,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'dghdfghdfgfdgdf',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 2314,
        burned: false,
        cw721_contract_id: 1,
      },
    ],
  };

  broker = new ServiceBroker({ logger: false });

  cw721ActivityUpdateOwnerService = this.broker.createService(
    Cw721ActivityUpdateOwnerService
  ) as Cw721ActivityUpdateOwnerService;

  @BeforeAll()
  async initSuite() {
    this.cw721ActivityUpdateOwnerService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE code, cw721_contract, cw721_activity, block_checkpoint RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
    await CW721Contract.query().insertGraph(this.cw721Contract);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test updateCw721ActOwnerByToken')
  public async testUpdateCw721ActOwnerByToken() {
    const activities = [
      {
        action: 'mint',
        sender: 'fsgsfgfs',
        tx_hash: 'fgdfgdf',
        cw721_contract_id: 1,
        cw721_token_id: 1,
        from: 'fgsfdghgj',
        to: 'drsdrfsdfsd',
        height: 100,
        owner: null,
        smart_contract_event_id: null,
      },
      {
        action: 'transfer_nft',
        sender: 'hhhhhh',
        tx_hash: 'vzxvxzc',
        cw721_contract_id: 1,
        cw721_token_id: 1,
        from: 'fgfgfdg',
        to: 'mmmmmmmm',
        height: 200,
        owner: null,
        smart_contract_event_id: null,
      },
      {
        action: 'transfer_nft',
        sender: 'xdfzf',
        tx_hash: ' vgbhdghg',
        cw721_contract_id: 1,
        cw721_token_id: 1,
        from: 'ertrtwerrewqr',
        to: 'dsdasdasda',
        height: 300,
        owner: null,
        smart_contract_event_id: null,
      },
      {
        action: 'send_nft',
        sender: 'x cbcvbhcvdfzf',
        tx_hash: ' fgdfytyertr',
        cw721_contract_id: 1,
        cw721_token_id: 1,
        from: 'ertwrwrw',
        to: 'xgdfbdndg',
        height: 400,
        owner: null,
        smart_contract_event_id: null,
      },
      {
        action: 'burn',
        sender: ' asaadsd',
        tx_hash: ' xzcvxzvz',
        cw721_contract_id: 1,
        cw721_token_id: 1,
        from: 'fdfasda',
        to: 'tytytryrtyrt',
        height: 500,
        owner: null,
        smart_contract_event_id: null,
      },
      {
        action: 'transfer_nft',
        sender: 'ghfdyhtury',
        tx_hash: 'kkkkkk',
        cw721_contract_id: 1,
        cw721_token_id: 2,
        from: 'gfhvcgbdstg',
        to: 'xgrtrfgh',
        height: 200,
        owner: null,
        smart_contract_event_id: null,
      },
      {
        action: 'approve',
        sender: ' asaadsd',
        tx_hash: ' xzcvxzvz',
        cw721_contract_id: 1,
        cw721_token_id: 1,
        from: 'fdfasda',
        to: 'tytytryrtyrt',
        height: 250,
        owner: null,
        smart_contract_event_id: null,
      },
    ];
    await CW721Activity.query().insert(
      activities.map((e) => CW721Activity.fromJson(e))
    );
    await this.cw721ActivityUpdateOwnerService.updateCw721ActOwnerByToken({
      cw721ContractId: 1,
      cw721TokenId: 1,
    });
    const updatedActivities = await CW721Activity.query()
      .where('cw721_contract_id', 1)
      .andWhere('cw721_token_id', 1)
      .whereIn('action', [
        CW721_ACTION.MINT,
        CW721_ACTION.TRANSFER,
        CW721_ACTION.SEND_NFT,
        CW721_ACTION.BURN,
      ])
      .orderBy('height');
    expect(updatedActivities[0].owner).toEqual(activities[0].to);
    expect(updatedActivities[1].owner).toEqual(activities[0].to);
    expect(updatedActivities[2].owner).toEqual(activities[1].to);
    expect(updatedActivities[3].owner).toEqual(activities[2].to);
    expect(updatedActivities[4].owner).toEqual(activities[3].to);
    await this.cw721ActivityUpdateOwnerService.updateCw721ActOwnerByToken({
      cw721ContractId: 1,
      cw721TokenId: 2,
    });
    const updatedActivities2 = await CW721Activity.query()
      .where('cw721_contract_id', 1)
      .andWhere('cw721_token_id', 2)
      .whereIn('action', [
        CW721_ACTION.MINT,
        CW721_ACTION.TRANSFER,
        CW721_ACTION.SEND_NFT,
        CW721_ACTION.BURN,
      ])
      .orderBy('height');
    expect(updatedActivities2[0].owner).toEqual(activities[5].to);
  }
}

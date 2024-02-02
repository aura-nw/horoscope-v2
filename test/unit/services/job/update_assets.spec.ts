import {
  AfterAll,
  AfterEach,
  BeforeAll,
  Describe,
  Test,
} from '@jest-decorated/core';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import config from '../../../../config.json' assert { type: 'json' };
import knex from '../../../../src/common/utils/db_connection';
import { Code, Cw20Contract } from '../../../../src/models';
import { Asset } from '../../../../src/models/asset';
import UpdateAssetsJob from '../../../../src/services/job/update_assets.service';

@Describe('Test update assets service')
export default class UpdateAssetsJobTest {
  broker = new ServiceBroker({ logger: false });

  updateAssetsJob = this.broker.createService(
    UpdateAssetsJob
  ) as UpdateAssetsJob;

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
      {
        code_id: 100,
        address: 'mock_contract_address_2',
        name: 'name',
        creator: 'phamphong_creator 2',
        instantiate_hash: 'abc',
        instantiate_height: 300000,
      },
    ],
  };

  cw20Contract = [
    {
      ...Cw20Contract.fromJson({
        smart_contract_id: 1,
        marketing_info: {},
        total_supply: '1121112133',
        symbol: 'TEST SyMbol',
        minter: 'jfglkdfjgklfdgklklfdkl',
        name: 'dgbdfmnlkgsdfklgjksdfl',
        track: true,
        last_updated_height: 10000,
      }),
    },
    {
      ...Cw20Contract.fromJson({
        smart_contract_id: 2,
        marketing_info: {},
        total_supply: '23434314',
        symbol: 'TEST SyMbol 2',
        minter: 'pham phong',
        name: 'hic',
        track: true,
        last_updated_height: 15022,
      }),
    },
  ];

  @BeforeAll()
  async initSuite() {
    this.updateAssetsJob.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE code, cw20_contract, asset RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    this.updateAssetsJob.getQueueManager().stopAll();
  }

  @AfterEach()
  async afterEach() {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('')
  async test() {
    const mockAssets = [
      {
        denom: config.networkDenom,
        amount: '6000000',
        origin: undefined,
      },
      {
        denom:
          'ibc/64846F530A4FFAF387CFC4F3F369EA9C83FC158B7F09B4573DD9A3EE8EA49F06',
        amount: '7716100',
        origin: 'channel-2',
      },
    ];
    const mockCw20Tokens = [
      {
        ...Cw20Contract.fromJson({
          smart_contract_id: 1,
          marketing_info: {},
          total_supply: '1121112133',
          symbol: 'TEST SyMbol',
          minter: 'jfglkdfjgklfdgklklfdkl',
          name: 'dgbdfmnlkgsdfklgjksdfl',
          track: true,
          last_updated_height: 10000,
        }),
      },
      {
        ...Cw20Contract.fromJson({
          smart_contract_id: 2,
          marketing_info: {},
          total_supply: '23434314',
          symbol: 'TEST SyMbol 2',
          minter: 'pham phong',
          name: 'hic',
          track: true,
          last_updated_height: 15022,
        }),
      },
    ];
    await Cw20Contract.query().insert(mockCw20Tokens);
    jest.spyOn(this.updateAssetsJob, 'queryRpcAssets').mockResolvedValue([]);
    jest
      .spyOn(this.updateAssetsJob, 'queryRpcOriginAssets')
      .mockResolvedValue(mockAssets);
    await this.updateAssetsJob.jobUpdateAssets();
    let assets = await Asset.query();
    const cw20Tokens = await Cw20Contract.query().withGraphFetched(
      'smart_contract'
    );
    expect(assets.length).toEqual(mockAssets.length + mockCw20Tokens.length);
    const assetsKeyByDenom = _.keyBy(assets, 'denom');
    cw20Tokens.forEach((cw20Token) => {
      const result = assetsKeyByDenom[cw20Token.smart_contract.address];
      expect(result.origin_id).toEqual(cw20Token.id.toString(10));
      expect(result.name).toEqual(cw20Token.name);
      expect(result.type).toEqual(Asset.TYPE.CW20_TOKEN);
      expect(result.total_supply).toEqual(cw20Token.total_supply);
    });
    const nativeAsset = assetsKeyByDenom[mockAssets[0].denom];
    expect(nativeAsset.origin_id).toBeNull();
    expect(nativeAsset.name).toBeNull();
    expect(nativeAsset.type).toEqual(Asset.TYPE.NATIVE);
    expect(nativeAsset.total_supply).toEqual(mockAssets[0].amount);
    const ibcAsset = assetsKeyByDenom[mockAssets[1].denom];
    expect(ibcAsset.origin_id).toEqual(mockAssets[1].origin);
    expect(ibcAsset.name).toBeNull();
    expect(ibcAsset.type).toEqual(Asset.TYPE.IBC_TOKEN);
    expect(ibcAsset.total_supply).toEqual(mockAssets[1].amount);
    const updateAssets = [
      {
        denom: config.networkDenom,
        amount: '122313465',
        origin: undefined,
      },
      {
        denom:
          'ibc/64846F530A4FFAF387CFC4F3F369EA9C83FC158B7F09B4573DD9A3EE8EA49F06',
        amount: '456774',
        origin: 'channel-2',
      },
      {
        denom:
          'ibc/ABCD6F530A4FFAF387CFC4F3F369EA9C83FC158B7F09B4573DD9A3EE8EA4XYZT',
        amount: '456774',
        origin: 'channel-2',
      },
    ];
    jest
      .spyOn(this.updateAssetsJob, 'queryRpcOriginAssets')
      .mockResolvedValue(updateAssets);
    await this.updateAssetsJob.jobUpdateAssets();
    assets = await Asset.query();
    expect(assets.length).toEqual(updateAssets.length + mockCw20Tokens.length);
    const updatedAssetsKeyByDenom = _.keyBy(assets, 'denom');
    const updatedNativeAsset = updatedAssetsKeyByDenom[updateAssets[0].denom];
    expect(updatedNativeAsset).toMatchObject({
      ..._.omit(nativeAsset, 'updated_at'),
      total_supply: updateAssets[0].amount,
    });
    const updatedIbcAsset = updatedAssetsKeyByDenom[updateAssets[1].denom];
    expect(updatedIbcAsset).toMatchObject({
      ..._.omit(ibcAsset, 'updated_at'),
      total_supply: updateAssets[1].amount,
    });
    const newIbcAsset = updatedAssetsKeyByDenom[updateAssets[2].denom];
    expect(newIbcAsset).toMatchObject({
      origin_id: updateAssets[2].origin,
      name: null,
      type: Asset.TYPE.IBC_TOKEN,
      total_supply: updateAssets[2].amount,
    });
  }
}

import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CW721Token from '../../../../src/models/cw721_token';
import CW721AssetService from '../../../../src/services/asset-indexer/cw721_asset.service';
import CW721Contract from '../../../../src/models/cw721_contract';

@Describe('Test cw721 asset service')
export default class CW721AssetTest {
  broker = new ServiceBroker({ logger: false });

  mockPayload = {
    address: 'phamphong_address',
    codeId: 'phamphong_codeid',
    txData: {
      txhash: 'phamphong_txhash',
      sender: 'phamphong_sender',
      action: 'phamphong_action',
    },
  };

  mockContractInfoAndMinter = {
    name: 'phamphong_name',
    symbol: 'phamphong_symbol',
    minter: 'phamphong_minter',
  };

  mockTokenList = ['1', '3', '5', '7', '9'];

  cw721AssetService = this.broker.createService(
    CW721AssetService
  ) as CW721AssetService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE cw721_tx, cw721_token, cw721_contract RESTART IDENTITY CASCADE'
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test job handler success')
  public async testJobHandler() {
    this.cw721AssetService._getTokenList = jest.fn((_address: string) =>
      Promise.resolve(this.mockTokenList)
    );
    this.cw721AssetService._getTokensInfo = jest.fn(
      (address: string, listTokens: string[]) =>
        Promise.resolve(
          listTokens.map((token) =>
            CW721Token.fromJson({
              token_id: token,
              token_uri: '',
              extension: null,
              owner: '',
              contract_address: address,
            })
          )
        )
    );
    this.cw721AssetService._getContractInfoAndMinter = jest.fn(
      (_address: string) => Promise.resolve(this.mockContractInfoAndMinter)
    );
    await this.cw721AssetService.jobHandlerEnrichCw721(this.mockPayload);
    const cw721Contract = await CW721Contract.query().first();
    expect({
      code_id: cw721Contract?.code_id,
      address: cw721Contract?.address,
      name: cw721Contract?.name,
      symbol: cw721Contract?.symbol,
      minter: cw721Contract?.minter,
    }).toEqual({
      code_id: this.mockPayload.codeId,
      address: this.mockPayload.address,
      name: this.mockContractInfoAndMinter.name,
      symbol: this.mockContractInfoAndMinter.symbol,
      minter: this.mockContractInfoAndMinter.minter,
    });
    const cw721Tokens = await CW721Token.query().orderBy('token_id');
    expect(
      cw721Tokens.map((token) => ({
        token_id: token.token_id,
        token_uri: '',
        extension: null,
        owner: '',
        contract_address: this.mockPayload.address,
      }))
    ).toEqual(
      this.mockTokenList.map((token_id) => ({
        token_id,
        token_uri: '',
        extension: null,
        owner: '',
        contract_address: this.mockPayload.address,
      }))
    );
  }
}

import { Describe, Test } from '@jest-decorated/core';
import AuraClient from '../../../src/common/utils/aurajs_client';

@Describe('Test aurajs client utils')
export default class CW20HoldersTest {
  @Test('Query cosmos success')
  public async testQueryCosmos() {
    const response =
      await AuraClient.cosmos.base.tendermint.v1beta1.getLatestBlock();
    expect(response).not.toBeUndefined();
  }

  @Test('Query wasm success')
  public async testQueryWasm() {
    const response = await AuraClient.cosmwasm.wasm.v1.codes();
    expect(response).not.toBeUndefined();
  }
}

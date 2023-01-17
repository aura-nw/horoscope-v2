import { Describe, BeforeAll, Test, AfterAll } from '@jest-decorated/core';
import TxResultModel from '../../../src/models/TxResultModel';

@Describe('Test sync')
export default class SyncTest {
  @BeforeAll()
  initSuite() {}

  @AfterAll()
  tearDown() {}

  @Test('test sync transaction in DB')
  public async testSyncTxSuccess() {
    // const client = await getClient();
    // const [firstAccount] = await getAccounts();
    // const recipient = 'aura1myv43sqgnj5sm4zl98ftl45af9cfzk7nylzq5u';
    // const amount = {
    //   denom: 'uaura',
    //   amount: '100',
    // };

    // await client.sendTokens(
    //   firstAccount.address,
    //   recipient,
    //   [amount],
    //   'auto',
    //   ''
    // );

    const tx = await TxResultModel.query().first();
    if (tx) {
      console.log(tx.getTxContent());
    }
  }
}

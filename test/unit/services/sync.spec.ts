import { Describe, BeforeAll, Test, AfterAll } from '@jest-decorated/core';
import knex from '../../../src/common/utils/db-connection';
// import { sleep } from '../../../src/common/utils/helper';
// import { getAccounts, getClient } from '../../../src/common/utils/blockchain';
// import TxResultModel from '../../../src/models/TxResultModel';

@Describe('Test sync')
export default class SyncTest {
  @BeforeAll()
  async initSuite() {
    await knex.schema.raw(
      'TRUNCATE TABLE attributes, events, blocks, tx_results CASCADE'
    );
  }

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
    // await sleep(1000);
    // const tx = await TxResultModel.query().first();
    // if (tx) {
    //   console.log(tx);
    // }
  }
}

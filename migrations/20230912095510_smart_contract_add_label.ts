import { Knex } from 'knex';
import { getHttpBatchClient } from '../src/common';
import { SmartContract } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract', (table) => {
    table.string('label');
  });
  await knex.transaction(async (trx) => {
    const smartContracts = await SmartContract.query().transacting(trx);
    if (smartContracts.length > 0) {
      const contractsInfo = await SmartContract.getContractInfos(
        smartContracts.map((smartContract) => smartContract.address),
        getHttpBatchClient()
      );
      smartContracts.forEach((smartContract, index) => {
        smartContract.label = contractsInfo[index]?.contractInfo?.label;
      });
      await SmartContract.query()
        .transacting(trx)
        .insert(smartContracts)
        .onConflict('id')
        .merge();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract', (table) => {
    table.dropColumn('label');
  });
}

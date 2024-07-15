import { Knex } from 'knex';
import { Erc20Activity } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Erc20Activity.tableName, (table) => {
    table.bigint('cosmos_event_id').index();
    table.integer('cosmos_tx_id').index();
    table.setNullable('evm_event_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Erc20Activity.tableName, (table) => {
    table.dropColumn('cosmos_event_id');
    table.dropColumn('cosmos_tx_id');
    table.dropNullable('evm_event_id');
  });
}

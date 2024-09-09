import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_block', (table) => {
    table.index('miner');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_block', (table) => {
    table.dropIndex('miner');
  });
}

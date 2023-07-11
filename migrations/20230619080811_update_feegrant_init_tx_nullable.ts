import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feegrant', (table) => {
    table.integer('init_tx_id').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feegrant', (table) => {
    table.integer('init_tx_id').notNullable().alter();
  });
}

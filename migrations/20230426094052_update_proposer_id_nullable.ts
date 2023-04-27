import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.integer('proposer_id').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.integer('proposer_id').notNullable().alter();
  });
}

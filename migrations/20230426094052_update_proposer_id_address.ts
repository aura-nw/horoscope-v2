import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.dropColumn('proposer_id');
    table.string('proposer_address').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.dropColumn('proposer_address');
    table.integer('proposer_id').notNullable().alter();
  });
}

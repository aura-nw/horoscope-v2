import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.string('evm_address').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.dropColumn('evm_address');
  });
}

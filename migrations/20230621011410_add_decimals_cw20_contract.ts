import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_contract', (table: any) => {
    table.string('decimal');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_contract', (table: any) => {
    table.dropColumn('decimal');
  });
}

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_tx', (table) => {
    table.dropForeign('id_token');
    table.dropColumns('id_token', 'from', 'to');
    table.string('sender').index();
  });
}

export async function down(knex: Knex): Promise<void> {}

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex.raw(`
      ALTER TABLE smart_contract_event DROP CONSTRAINT smart_contract_event_event_id_foreign
    `);
  });
}

export async function down(knex: Knex): Promise<void> {}

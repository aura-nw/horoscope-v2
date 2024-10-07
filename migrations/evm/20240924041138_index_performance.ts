import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('set statement_timeout to 0');
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS erc721_token_erc721_contract_address_id_index ON erc721_token(erc721_contract_address, id)'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS erc721_activity_contract_action_id_index on erc721_activity (erc721_contract_address, action, id)'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS erc721_holder_statistic_erc721_contract_address_count_index ON erc721_holder_statistic(erc721_contract_address, count)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX erc721_token_erc721_contract_address_id_index`);
  await knex.raw(`DROP INDEX erc721_activity_contract_action_id_index`);
  await knex.raw(
    `DROP INDEX erc721_holder_statistic_erc721_contract_address_count_index`
  );
}

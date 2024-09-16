import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`set statement_timeout to 0`);
  await knex.raw(`
    CREATE TABLE erc721_holder_statistic AS
      select count(*), erc721_token.owner, erc721_token.erc721_contract_address
      from erc721_token 
      group by erc721_token.owner, erc721_token.erc721_contract_address;
    ALTER TABLE erc721_holder_statistic ADD COLUMN id SERIAL PRIMARY KEY;
    CREATE INDEX erc721_holder_statistic_owner_index
      ON erc721_holder_statistic (owner);
    CREATE UNIQUE INDEX erc721_holder_statistic_erc721_contract_address_owner_index
      ON erc721_holder_statistic (erc721_contract_address, owner);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('erc721_holder_statistic');
}

import { Knex } from 'knex';
import config from '../../config.json' assert { type: 'json' };
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`set statement_timeout to ${config.erc721.statementTimeout}`);
  await knex.raw(`
  CREATE MATERIALIZED VIEW m_view_erc721_holder_statistic AS
    select count(*), erc721_token.owner, erc721_token.erc721_contract_address
    from erc721_token 
    group by erc721_token.owner, erc721_token.erc721_contract_address
`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropMaterializedViewIfExists(
    'm_view_erc721_holder_statistic'
  );
}

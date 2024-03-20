import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS cw721_token_owner_not_burned ON cw721_token USING btree (owner ASC NULLS LAST, burned ASC NULLS LAST) WHERE NOT burned;`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS cw721_token_owner_not_burned`);
}

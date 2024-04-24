import { Knex } from 'knex';
import { EvmSignatureMapping } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `
      CREATE TABLE ${EvmSignatureMapping.tableName}
      (
        topic_hash varchar(66) PRIMARY KEY,
        human_readable_topic VARCHAR(255) NOT NULL
      );
  `
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE ${EvmSignatureMapping.tableName}`);
}

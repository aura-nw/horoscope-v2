import { Knex } from 'knex';
import { EvmSignatureMapping } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE ${EvmSignatureMapping.tableName}
    ADD COLUMN minimal_topic_hash VARCHAR(8) DEFAULT NULL;
    CREATE INDEX idx_minimal_topic_hash ON ${EvmSignatureMapping.tableName}("minimal_topic_hash") WHERE minimal_topic_hash IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {}

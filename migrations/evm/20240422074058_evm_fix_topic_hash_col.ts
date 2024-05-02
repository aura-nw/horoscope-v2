import { Knex } from 'knex';
import { EvmSignatureMapping } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmSignatureMapping.tableName, (table) => {
    table.string('human_readable_topic', 500).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmSignatureMapping.tableName, (table) => {
    table.string('human_readable_topic', 255).alter();
  });
}

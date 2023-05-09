import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('delegator', (table: any) => {
    table.increments();
    table.integer('validator_id').index().notNullable();
    table.string('delegator_address').index().notNullable();
    table.decimal('amount', 30, 0).notNullable();
    table.foreign('validator_id').references('validator.id');
  });
  await knex.schema.alterTable('validator', (table) => {
    table.jsonb('delegators');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.dropColumn('delegators');
  });
  await knex.schema.dropTable('delegator');
}

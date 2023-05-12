import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('delegator', (table: any) => {
    table.increments();
    table.integer('validator_id').index().notNullable();
    table.string('delegator_address').index().notNullable();
    table.decimal('amount', 30, 0).notNullable();
    table.unique(['validator_id', 'delegator_address']);
    table.foreign('validator_id').references('validator.id');
  });
  await knex.schema.alterTable('validator', (table) => {
    table.integer('delegators_count').index().defaultTo(0).notNullable();
    table.integer('delegators_last_height').index().defaultTo(0).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.dropColumn('delegators_last_height');
    table.dropColumn('delegators_count');
  });
  await knex.schema.dropTable('delegator');
}

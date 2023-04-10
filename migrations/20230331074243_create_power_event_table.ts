import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('power_event', (table: any) => {
    table.increments();
    table.integer('tx_id').index().notNullable();
    table.integer('height').index().notNullable();
    table.integer('delegator_id').index().notNullable();
    table.integer('validator_src_id').index().notNullable();
    table.integer('validator_dst_id').index();
    table.string('type').index().notNullable();
    table.decimal('amount', 30, 0).notNullable();
    table.timestamp('time').notNullable();
    table.foreign('tx_id').references('transaction.id');
    table.foreign('delegator_id').references('account.id');
    table.foreign('validator_src_id').references('validator.id');
    table.foreign('validator_dst_id').references('validator.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('power_event');
}

import { Knex } from 'knex';
import { AccountStake } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('account_stake', (table: any) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.integer('account_id').index().notNullable();
    table.integer('validator_src_id').index().notNullable();
    table.integer('validator_dst_id').index();
    table.string('type').index().notNullable();
    table.decimal('balance', 30, 0).notNullable();
    table.timestamp('end_time');
    table.foreign('account_id').references('account.id');
    table.foreign('validator_src_id').references('validator.id');
    table.foreign('validator_dst_id').references('validator.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('account_stake');
}

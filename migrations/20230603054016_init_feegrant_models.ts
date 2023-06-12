import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('feegrant', (table) => {
    table.increments('id').primary();
    table.integer('init_tx_id').index().notNullable();
    table.integer('revoke_tx_id').index();
    table.string('granter').index();
    table.string('grantee').index();
    table.string('type');
    table.timestamp('expiration');
    table.string('status');
    table.decimal('spend_limit', 80, 0);
    table.string('denom');
    table.foreign('init_tx_id').references('transaction.id');
  });
  await knex.schema.createTable('feegrant_history', (table) => {
    table.increments('id').primary();
    table.integer('tx_id').index().notNullable();
    table.integer('feegrant_id').index();
    table.string('granter').index();
    table.string('grantee').index();
    table.string('action');
    table.decimal('amount', 80, 0);
    table.string('denom');
    table.foreign('tx_id').references('transaction.id');
    table.foreign('feegrant_id').references('feegrant.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('feegrant_history');
  await knex.schema.dropTable('feegrant');
}

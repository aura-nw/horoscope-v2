import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('evm_smart_contract', (table) => {
    table.increments();
    table.dateTime('created_at');
    table.dateTime('updated_at');
    table.string('address').unique().notNullable();
    table.string('creator').index();
    table.integer('created_height').index();
    table.string('created_hash').index();
    table.string('type').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('evm_smart_contract');
}

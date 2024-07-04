import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('optimism_deposit', (table) => {
    table.increments();
    table.integer('l1_block').index();
    table.string('l1_tx_hash').index();
    table.string('l1_sender').index();
    table.string('l2_tx_hash').index();
    table.decimal('gas_used', 80, 0);
    table.timestamp('timestamp').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('optimism_deposit');
}

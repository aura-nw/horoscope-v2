import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('optimism_withdrawal', (table) => {
    table.increments();
    table.string('msg_nonce').index();
    table.string('sender').index();
    table.string('l2_tx_hash').index();
    table.integer('l2_block').index();
    table.timestamp('timestamp').index();
    table.string('status').index();
    table.integer('evm_event_id').index();
    table.string('l1_tx_hash').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('optimism_withdrawal');
}

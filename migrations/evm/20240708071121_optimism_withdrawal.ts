import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('optimism_withdrawal', (table) => {
    table.increments();
    table.string('msg_nonce').index();
    table.string('sender').index();
    table.string('l2_tx_hash').index();
    table.string('l2_block').index();
    table.timestamp('timestamp').index();
  });

  await knex.schema.createTable('optimism_withdrawal_event', (table) => {
    table.increments();
    table.string('withdrawal_hash').index();
    table.string('l1_event_type').index();
    table.timestamp('l1_timestamp').index();
    table.string('l1_tx_hash').index();
    table.string('l1_block').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('optimism_withdrawal');
  await knex.schema.dropTable('optimism_withdrawal_event');
}

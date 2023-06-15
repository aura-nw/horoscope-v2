import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibc_progress', (table) => {
    table.increments();
    table.integer('tx_send_hash').index();
    table.integer('tx_receive_hash').index();
    table.integer('tx_ack_hash').index();
    table.integer('tx_timeout_hash').index();
    table.string('channel_id').index();
    table.string('packet_sequence').index();
    table.jsonb('packet_data');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('ibc_progress');
}

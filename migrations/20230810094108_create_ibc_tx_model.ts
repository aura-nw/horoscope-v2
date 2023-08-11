import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibc_message', (table) => {
    table.increments();
    table.integer('transaction_message_id').index();
    table.string('src_channel_id').notNullable();
    table.string('src_port_id').notNullable();
    table.string('dst_channel_id').notNullable();
    table.string('dst_port_id').notNullable();
    table.string('type').notNullable();
    table.integer('sequence').notNullable();
    table.string('sequence_key').notNullable();
    table.foreign('ibc_client_id').references('ibc_client.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ibc_message');
}

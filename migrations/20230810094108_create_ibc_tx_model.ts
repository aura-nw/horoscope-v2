import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibc_message', (table) => {
    table.increments();
    table.integer('transaction_message_id').index();
    table.string('src_channel_id').notNullable().index();
    table.string('src_port_id').notNullable().index();
    table.string('dst_channel_id').notNullable().index();
    table.string('dst_port_id').notNullable().index();
    table.string('type').notNullable().index();
    table.integer('sequence').notNullable().index();
    table.string('sequence_key').notNullable().index();
    table.jsonb('data');
    table
      .foreign('transaction_message_id')
      .references('transaction_message.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ibc_message');
}

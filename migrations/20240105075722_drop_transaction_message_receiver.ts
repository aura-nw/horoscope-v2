import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transaction_message_receiver');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.createTable(
    'transaction_message_receiver',
    (table: any) => {
      table.increments('id').primary();
      table.integer('tx_msg_id').index().notNullable();
      table.string('address').index().notNullable();
      table.string('reason');
      table.foreign('tx_msg_id').references('transaction_message.id');
    }
  );
}

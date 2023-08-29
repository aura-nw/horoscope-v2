import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibc_ics20', (table) => {
    table.increments();
    table.integer('ibc_message_id').notNullable().unique();
    table.string('sender').index();
    table.string('receiver').index().notNullable();
    table.decimal('amount', 80, 0).notNullable();
    table.string('denom').notNullable().index();
    table.boolean('status').defaultTo(true);
    table.foreign('ibc_message_id').references('ibc_message.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ibc_ics20');
}

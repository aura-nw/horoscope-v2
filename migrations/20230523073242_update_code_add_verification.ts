import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('code_id_verification', (table: any) => {
    table.integer('code_id').primary();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.text('instantiate_msg_schema');
    table.text('query_msg_schema');
    table.text('execute_msg_schema');
    table.string('s3_location');
    table.string('contract_verification').index();
    table.string('compiler_version').index();
    table.string('url');
    table.jsonb('verify_step').notNullable();
    table.timestamp('verified_at');
    table.foreign('code_id').references('code.code_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('code_id_verification');
}

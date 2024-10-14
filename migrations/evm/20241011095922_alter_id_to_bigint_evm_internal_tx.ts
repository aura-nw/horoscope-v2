import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    'ALTER TABLE evm_internal_transaction ALTER COLUMN "id" SET DATA TYPE bigint'
  );
  await knex.raw('ALTER SEQUENCE evm_internal_transaction_id_seq AS bigint');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    'ALTER TABLE evm_internal_transaction ALTER COLUMN "id" SET DATA TYPE integer'
  );
  await knex.raw('ALTER SEQUENCE evm_internal_transaction_id_seq AS integer');
}

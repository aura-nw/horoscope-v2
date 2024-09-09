import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('SET statement_timeout TO 0');
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropIndex('tx_id');
    table.dropIndex('tx_msg_id');
    table.dropIndex('from');
    table.dropIndex('to');
    table.dropIndex('hash');
    table.dropIndex('status');
    table.dropIndex('contract_address');
  });
  await knex.raw(`
    alter table evm_transaction 
	alter column "from" set data type bytea USING decode(substring("from",3), 'hex'),
	alter column "to" set data type bytea USING decode(substring("to",3), 'hex'),
    alter column "data" set data type bytea USING decode("data", 'hex'),
	alter column "hash" set data type bytea USING decode(substring("hash",3), 'hex'),
	alter column "contract_address" set data type bytea USING decode(substring("contract_address",3), 'hex')`);
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.index('from', 'evm_transaction_from_index', 'hash');
    table.index('to', 'evm_transaction_to_index', 'hash');
    table.index(
      'contract_address',
      'evm_transaction_contract_address_index',
      'hash'
    );
    table.index('hash', 'evm_transaction_hash_index', 'hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('SET statement_timeout TO 0');
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropIndex('from');
    table.dropIndex('to');
    table.dropIndex('hash');
    table.dropIndex('contract_address');
  });
  await knex.raw(`
    alter table evm_transaction 
	alter column "from" set data type character varying(255),
	alter column "to" set data type character varying(255),
	alter column "hash" set data type character varying(255),
    alter column "data" set data type text,
	alter column "contract_address" set data type character varying(255)`);
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.index('tx_id', 'evm_transaction_tx_id_index', 'btree');
    table.index('tx_msg_id', 'evm_transaction_tx_msg_id_index', 'btree');
    table.index('status', 'evm_transaction_status_index', 'btree');
    table.index('from', 'evm_transaction_from_index', 'btree');
    table.index('to', 'evm_transaction_to_index', 'btree');
    table.index(
      'contract_address',
      'evm_transaction_contract_address_index',
      'btree'
    );
    table.index('hash', 'evm_transaction_hash_index', 'btree');
  });
}

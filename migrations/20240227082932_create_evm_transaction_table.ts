import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE TABLE evm_transaction(
      id SERIAL PRIMARY KEY,
      hash VARCHAR(255) NOT NULL,
      height integer NOT NULL,
      "from" VARCHAR(255),
      "to" VARCHAR(255),
      size VARCHAR(255),
      value VARCHAR(255),
      gas bigint,
      gas_fee_cap bigint,
      gas_tip_cap bigint,
      nonce bigint,
      data text,
      tx_id integer,
      tx_msg_id integer) PARTITION BY RANGE (id);
    CREATE INDEX evm_transaction_from_index ON evm_transaction("from");
    CREATE INDEX evm_transaction_hash_index ON evm_transaction(hash);
    CREATE INDEX evm_transaction_height_index ON evm_transaction(height);
    CREATE INDEX evm_transaction_to_index ON evm_transaction("to");
    CREATE INDEX evm_transaction_tx_msg_id_index ON evm_transaction(tx_msg_id);
    CREATE INDEX evm_transaction_tx_id_index ON evm_transaction(tx_id);`
  );
  let endId = config.createEVMTransactionPartition.endId;
  let step = config.createEVMTransactionPartition.step;
  for (let i = 0; i < endId; i += step) {
    const partitionName = `evm_transaction_partition_${i}_${i + step}`;
    await knex.raw(
      `CREATE TABLE ${partitionName} (LIKE evm_transaction INCLUDING ALL)`
    );
    await knex.raw(
      `ALTER TABLE evm_transaction ATTACH PARTITION ${partitionName} FOR VALUES FROM (${i}) to (${
        i + step
      })`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  const listTablePartition: any = await knex.raw(
    `SELECT
    parent.relname      AS parent,
    child.relname       AS child,
  pg_get_expr(child.relpartbound, child.oid) AS bounds
  FROM pg_inherits
      JOIN pg_class parent            ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child             ON pg_inherits.inhrelid   = child.oid
  WHERE parent.relname='evm_transaction';`
  );
  await Promise.all(
    listTablePartition.rows.map((partition: any) => {
      return knex.raw(`DROP TABLE ${partition.child}`);
    })
  );
  await knex.raw('DROP TABLE evm_transaction');
}

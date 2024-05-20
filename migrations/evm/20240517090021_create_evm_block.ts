import { Knex } from 'knex';
import config from '../../config.json' assert { type: 'json' };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE TABLE evm_block(
      height integer,
      tx_count integer,
      base_fee_per_gas numeric(80,0),
      date timestamp with time zone,
      difficulty numeric(80,0),
      extra_data text,
      gas_limit numeric(80,0),
      gas_used numeric(80,0),
      hash text,
      miner text,
      nonce text,
      parent_hash text,
      receipts_root text,
      state_root text,
      transactions jsonb
    ) PARTITION BY RANGE(height);
    CREATE INDEX evm_blockheight_index ON evm_block(height);
    CREATE INDEX evm_block_hash_index ON evm_block(hash);
    CREATE INDEX evm_block_date_index ON evm_block(date);`
  );
  let endId = config.createEvmBlockToPartition.endId;
  let step = config.createEvmBlockToPartition.step;
  for (let i = 0; i < endId; i += step) {
    const partitionName = `evm_block_partition_${i}_${i + step}`;
    await knex.raw(
      `CREATE TABLE ${partitionName} (LIKE evm_block INCLUDING ALL)`
    );
    await knex.raw(
      `ALTER TABLE evm_block ATTACH PARTITION ${partitionName} FOR VALUES FROM (${i}) to (${
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
  WHERE parent.relname='evm_block';`
  );
  await Promise.all(
    listTablePartition.rows.map((partition: any) => {
      return knex.raw(`DROP TABLE ${partition.child}`);
    })
  );
  await knex.raw('DROP TABLE evm_block');
}

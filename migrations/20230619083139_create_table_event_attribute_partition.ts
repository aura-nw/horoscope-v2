import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };
import { BULL_JOB_NAME } from '../src/common';
export async function up(knex: Knex): Promise<void> {
  console.log('Migrating event_attribute to use partition');
  await knex.transaction(async (trx) => {
    //create new event_attribute_partition table like event_attribute, but add block_height to primary key
    await knex.raw(
      `CREATE TABLE IF NOT EXISTS event_attribute_partition
      (
          event_id integer NOT NULL,
          key character varying(255) NOT NULL,
          value text NOT NULL,
          tx_id integer,
          block_height integer NOT NULL,
          composite_key character varying(255),
          index integer NOT NULL,
          CONSTRAINT event_attribute_partition_pkey PRIMARY KEY (event_id, index, block_height),
          CONSTRAINT event_attribute_partition_block_height_foreign FOREIGN KEY (block_height)
              REFERENCES block (height) MATCH SIMPLE,
          CONSTRAINT event_attribute_partition_tx_id_foreign FOREIGN KEY (tx_id)
              REFERENCES transaction (id) MATCH SIMPLE,
          CONSTRAINT event_attribute_partition_event_id_foreign FOREIGN KEY (event_id)
              REFERENCES event (id) MATCH SIMPLE
      ) partition by range(block_height);
      
      CREATE INDEX IF NOT EXISTS event_attribute_partition_composite_key_index
          ON event_attribute_partition USING btree
          (composite_key ASC NULLS LAST);
        
      CREATE INDEX IF NOT EXISTS event_attribute_partition_block_height_index
          ON event_attribute_partition USING btree
          (block_height ASC NULLS LAST);
      
      CREATE INDEX IF NOT EXISTS event_attribute_partition_tx_id_index
          ON event_attribute_partition USING btree
          (tx_id ASC NULLS LAST);
      
      CREATE INDEX IF NOT EXISTS event_attribute_partition_value_index
          ON event_attribute_partition USING btree
          (value ASC NULLS LAST)
          WHERE length(value) <= 100;
      
      CREATE INDEX IF NOT EXISTS transaction_event_attribute_partition_key_index
          ON event_attribute_partition USING btree
          (key ASC NULLS LAST);`
    );

    // rename 2 table event_attribute and event_attribute_backup
    await knex
      .raw('alter table event_attribute rename to event_attribute_backup;')
      .transacting(trx);
    await knex
      .raw('alter table event_attribute_partition rename to event_attribute;')
      .transacting(trx);
    const currentId = {
      event_id: 0,
      index: 0,
    };
    const startBlock = config.migrationEventAttributeToPartition.startBlock;
    const endBlock = config.migrationEventAttributeToPartition.endBlock;
    const step = config.migrationEventAttributeToPartition.step;
    for (let i = startBlock; i < endBlock; i += step) {
      const tableName = `event_attribute_partition_${i}_${i + step}`;
      // create new partition table
      await knex
        .raw(`create table ${tableName} (like event_attribute including all)`)
        .transacting(trx);
      // attach partition to table event_attribute
      await knex
        .raw(
          `alter table event_attribute attach partition ${tableName} for values from (${i}) to (${
            i + step
          })`
        )
        .transacting(trx);
    }
    // insert block_checkpoint for job create event attribute partition
    await knex.raw(
      `insert into block_checkpoint(job_name, height) values ('${BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION}', ${endBlock})`
    );

    // insert data from event_attribute_backup to event_attribute
    const limitRecordGet =
      config.migrationEventAttributeToPartition.limitRecordGet;
    const chunkSizeInsert =
      config.migrationEventAttributeToPartition.chunkSizeInsert;
    let done = false;
    while (!done) {
      console.log(JSON.stringify(currentId));

      const eventAttributes = await knex('event_attribute_backup')
        .select('*')
        .whereRaw(
          `(event_id, index) > (${currentId.event_id}, ${currentId.index})`
        )
        .orderBy([
          { column: 'event_id', order: 'asc' },
          { column: 'index', order: 'asc' },
        ])
        .limit(limitRecordGet)
        .transacting(trx);
      if (eventAttributes.length === 0) {
        done = true;
        break;
      }
      await knex
        .batchInsert('event_attribute', eventAttributes, chunkSizeInsert)
        .transacting(trx);

      currentId.event_id = eventAttributes[eventAttributes.length - 1].event_id;
      currentId.index = eventAttributes[eventAttributes.length - 1].index;
    }

    // create view for new table event_attribute
    await knex.schema.createViewOrReplace(
      'view_event_attribute_value_index',
      (viewBuilder) => {
        viewBuilder.as(
          knex('event_attribute').select('*').whereRaw('length(value) <= 100')
        );
      }
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex
      .raw('alter table event_attribute rename to event_attribute_revert;')
      .transacting(trx);
    await knex
      .raw('alter table event_attribute_backup rename to event_attribute;')
      .transacting(trx);
    // create view for table event_attribute
    await knex.schema.createViewOrReplace(
      'view_event_attribute_value_index',
      (viewBuilder) => {
        viewBuilder.as(
          knex('event_attribute').select('*').whereRaw('length(value) <= 100')
        );
      }
    );
  });
}

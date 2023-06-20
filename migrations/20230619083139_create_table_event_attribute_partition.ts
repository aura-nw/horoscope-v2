import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };
export async function up(knex: Knex): Promise<void> {
  console.log('Migrating event_attribute to use partition');
  await knex.transaction(async (trx) => {
    await knex.raw(
      `create table event_attribute_partition 
        (like event_attribute including all) partition by range(block_height)`
    );
    await knex.schema
      .alterTable('event_attribute_partition', (table) => {
        table.dropPrimary();
        table.primary(['event_id', 'index', 'block_height']);
      })
      .transacting(trx);
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
    const startBlock = config.jobMigrationEventAttributeToPartition.startBlock;
    const endBlock = config.jobMigrationEventAttributeToPartition.endBlock;
    const step = config.jobMigrationEventAttributeToPartition.step;
    for (let i = startBlock; i <= endBlock; i += step) {
      const tableName = `event_attribute_partition_${i}_${i + step}`;
      await knex
        .raw(
          `create table ${tableName} (like event_attribute_backup including all)`
        )
        .transacting(trx);
      await knex
        .raw(
          `alter table event_attribute attach partition ${tableName} for values from (${i}) to (${
            i + step
          })`
        )
        .transacting(trx);
    }
    const limitRecordGet =
      config.jobMigrationEventAttributeToPartition.limitRecordGet;
    const chunkSizeInsert =
      config.jobMigrationEventAttributeToPartition.chunkSizeInsert;
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
  });
}

export async function down(knex: Knex): Promise<void> {}

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('create tx_id column in smart_contract_event');
  const chunkSizeQuery = 10000;
  let startId = 0;
  await knex.transaction(async (trx) => {
    await knex.schema.alterTable('smart_contract_event', (table) => {
      table.integer('tx_id').index();
    });
    let done = false;
    while (!done) {
      const smartContractEvents = await knex.raw(
        `select smart_contract_event.id smart_contract_event_id, 
        transaction.id transaction_id from smart_contract_event
        join event on event.id = smart_contract_event.event_id
        join transaction on event.tx_id = transaction.id
        where smart_contract_event.id > ${startId}
        order by smart_contract_event.id asc
        limit ${chunkSizeQuery};`
      );
      if (smartContractEvents.rows.length === 0) {
        done = true;
        break;
      }
      const stringListUpdates = smartContractEvents.rows
        .map(
          (update: any) =>
            `(${update.smart_contract_event_id}, ${update.transaction_id})`
        )
        .join(',');
      await knex.raw(
        `UPDATE smart_contract_event SET tx_id = temp.tx_id from (VALUES ${stringListUpdates}) as temp(id, tx_id) where temp.id = smart_contract_event.id`
      );
      startId =
        smartContractEvents.rows[smartContractEvents.rows.length - 1]
          .smart_contract_event_id;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract_event', (table) => {
    table.dropColumn('tx_id');
  });
}

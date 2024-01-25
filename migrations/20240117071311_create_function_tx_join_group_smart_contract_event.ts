import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION public.transaction_join_group_smart_contract_event(contractaddress character varying, limitValue int)
    RETURNS SETOF transaction
    LANGUAGE sql
    STABLE PARALLEL SAFE
    AS $function$
          select transaction.* from transaction right join (
            select tx_id as txid from smart_contract_event
            join smart_contract on smart_contract_event.smart_contract_id = smart_contract.id
            where smart_contract.address = contractaddress
            group by tx_id order by tx_id
            limit limitValue
          ) a on a.txid = transaction.id
    $function$`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP FUNCTION IF EXISTS public.transaction_join_group_smart_contract_event(contractaddress character varying)`);
}

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(
    `CREATE OR REPLACE FUNCTION public.transaction_join_group_transaction_message(
    sender character varying, limitvalue integer)
    RETURNS SETOF transaction
    LANGUAGE sql
    STABLE PARALLEL SAFE
    AS $function$
            select transaction.* from transaction right join (
              select tx_id as txid from transaction_message
              where sender = sender
              group by tx_id order by tx_id
              limit limitValue
            ) a on a.txid = transaction.id
        $function$`
  );
  await knex.schema.raw(
    `CREATE OR REPLACE FUNCTION public.transaction_join_group_coin_transfer(fromAddress character varying, toAddress character varying, limitValue integer)
    RETURNS SETOF transaction
    LANGUAGE sql
    STABLE PARALLEL SAFE
    AS $function$
          select transaction.* from transaction right join (
            select tx_id as txid from coin_transfer
            where coin_transfer.from = fromAddress or coin_transfer.to = toAddress
            group by tx_id order by tx_id
            limit limitValue
          ) a on a.txid = transaction.id
      $function$`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(
    `DROP FUNCTION IF EXISTS public.transaction_join_group_transaction_message(sender character varying, limitvalue integer)`
  );
  await knex.schema.raw(
    `DROP FUNCTION IF EXISTS public.transaction_join_group_coin_transfer(fromAddress character varying, toAddress character varying, limitValue integer)`
  );
}

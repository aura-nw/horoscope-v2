import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(
    `CREATE OR REPLACE function transaction_join_group_transaction_message(
      senderAddress character varying, 
      typesIn character varying[], 
      typesNotIn character varying[],
      limitValue int)  
    RETURNS SETOF transaction
    LANGUAGE plpgsql  
    STABLE PARALLEL SAFE
    AS  
    $$  
    begin
      if typesIn is null then 
        if typesNotIn is null then
          return query (select transaction.* from transaction right join (
            select tx_id as txid from transaction_message
            where transaction_message.sender = senderAddress
            group by tx_id order by tx_id
            limit limitValue
              ) a on a.txid = transaction.id);
        else
          return query (select transaction.* from transaction right join (
            select tx_id as txid from transaction_message
            where transaction_message.sender = senderAddress
            and type <> ALL(typesNotIn)
            group by tx_id order by tx_id
            limit limitValue
          ) a on a.txid = transaction.id);
        end if;
      else
        return query (select transaction.* from transaction right join (
          select tx_id as txid from transaction_message
          where transaction_message.sender = senderAddress
          and type = ANY(typesIn)
          group by tx_id order by tx_id
          limit limitValue
        ) a on a.txid = transaction.id);
      end if;
    end;
    $$;`
  );
  await knex.schema.raw(
    `CREATE OR REPLACE FUNCTION transaction_join_group_coin_transfer(
      addressFrom character varying, 
      addressTo character varying,
      typesIn character varying[], 
      typesNotIn character varying[],
      limitValue integer)
    RETURNS SETOF transaction
    LANGUAGE plpgsql
    STABLE PARALLEL SAFE
    AS $$
    begin
      if typesIn is null then
        if typesNotIn is null then
          return query (
            select transaction.* from transaction right join (
            select coin_transfer.tx_id as txid from coin_transfer
            join transaction_message on transaction_message.tx_id = coin_transfer.tx_id
            where (coin_transfer.from = addressFrom or coin_transfer.to = addressTo)
            group by coin_transfer.tx_id order by coin_transfer.tx_id limit limitValue
            ) a on a.txid = transaction.id
          );
        else 
          return query (
            select transaction.* from transaction right join (
            select coin_transfer.tx_id as txid from coin_transfer
            join transaction_message on transaction_message.tx_id = coin_transfer.tx_id
            where (coin_transfer.from = addressFrom or coin_transfer.to = addressTo)
            and type <> ALL(typesNotIn)
            group by coin_transfer.tx_id order by coin_transfer.tx_id limit limitValue
            ) a on a.txid = transaction.id
          ); 
        end if;
      else
        return query (
          select transaction.* from transaction right join (
          select coin_transfer.tx_id as txid from coin_transfer
          join transaction_message on transaction_message.tx_id = coin_transfer.tx_id
          where (coin_transfer.from = addressFrom or coin_transfer.to = addressTo)
          and type = ANY(typesIn)
          group by coin_transfer.tx_id order by coin_transfer.tx_id limit limitValue
          ) a on a.txid = transaction.id
        );
      end if;
    end;
    $$;`
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

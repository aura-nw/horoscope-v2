import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP FUNCTION IF EXISTS public.fetch_tx_ids_by_events(
      composite_key_in varchar[],
      value_eq varchar,
      tx_id_lte integer,
      tx_id_gte integer)`);

  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION public.fetch_tx_ids_by_events(
      composite_key_in varchar[],
      value_eq varchar,
      tx_id_gte integer default null,
      tx_id_lte integer default null,
      block_height_gte integer default null,
      block_height_lte integer default null
    )
    RETURNS SETOF view_event_attribute_value_index
    LANGUAGE sql
    STABLE PARALLEL SAFE
    AS $function$
        SELECT 1, 'k', 'v', view.tx_id, 1, 'c', 1
        FROM view_event_attribute_value_index as view
        JOIN event ON view.event_id = event.id
        WHERE event.tx_msg_index IS NOT NULL
            AND view.composite_key = ANY(composite_key_in)
            AND view.value = value_eq
            AND (tx_id_gte IS NULL OR view.tx_id >= tx_id_gte)
            AND (tx_id_lte IS NULL OR view.tx_id <= tx_id_lte)
            AND (block_height_gte IS NULL OR view.block_height >= block_height_gte)
            AND (block_height_lte IS NULL OR view.block_height <= block_height_lte)
        GROUP BY view.tx_id
        ORDER BY view.tx_id DESC
        LIMIT 100
    $function$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP FUNCTION IF EXISTS public.fetch_tx_ids_by_events(
      composite_key_in varchar[],
      value_eq varchar,
      tx_id_gte integer,
      tx_id_lte integer,
      block_height_gte integer,
      block_height_lte integer
    )`);
}

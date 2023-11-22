import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
  CREATE MATERIALIZED VIEW m_view_ibc_relayer_statistic AS
  SELECT
    ibc_client.counterparty_chain_id,
    COUNT(ibc_channel.id) AS total_channel,
    SUM(COALESCE(open_channel.open_channel, 0)) AS open_channel,
    SUM(COALESCE(ics20.total_asset_transfer, 0)) AS total_asset_transfer,
    SUM(COALESCE(ics20.send_asset_transfer, 0)) AS send_asset_transfer,
    SUM(COALESCE(ics20.receive_asset_transfer, 0)) AS receive_asset_transfer
  FROM
    ibc_channel
    INNER JOIN ibc_connection ON ibc_connection.id = ibc_channel.ibc_connection_id
    INNER JOIN ibc_client ON ibc_connection.ibc_client_id = ibc_client.id
    LEFT JOIN
    (
      SELECT ibc_channel.channel_id, Count(ibc_channel.id) AS open_channel
      FROM ibc_channel
      WHERE ibc_channel.state = 'OPEN'
      GROUP BY ibc_channel.channel_id
    ) AS open_channel
    ON ibc_channel.channel_id = open_channel.channel_id
    LEFT JOIN (
      SELECT ibc_channel.channel_id, Count(ibc_channel.id) AS total_asset_transfer, Count(ibc_channel_send.id) AS send_asset_transfer, Count(ibc_channel_receive.id) AS receive_asset_transfer
      FROM ibc_ics20
      INNER JOIN ibc_channel ON ibc_channel.channel_id = ibc_ics20.channel_id AND ibc_ics20.status = 'ack_success'
      LEFT JOIN ibc_channel AS ibc_channel_send ON ibc_channel_send.channel_id = ibc_ics20.channel_id AND ibc_ics20.type = 'send_packet' AND ibc_ics20.status = 'ack_success'
      LEFT JOIN ibc_channel AS ibc_channel_receive ON ibc_channel_receive.channel_id = ibc_ics20.channel_id AND ibc_ics20.type = 'recv_packet' AND ibc_ics20.status = 'ack_success'
      GROUP BY ibc_channel.channel_id
    ) AS ics20 ON ibc_channel.channel_id = ics20.channel_id
  GROUP BY ibc_client.counterparty_chain_id
`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropMaterializedViewIfExists('m_view_ibc_relayer_statistic');
}

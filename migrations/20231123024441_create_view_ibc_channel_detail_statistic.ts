import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createView('view_ibc_channel_detail_statistic', (view) => {
    view.as(
      knex('ibc_ics20')
        .select(
          'ibc_channel.channel_id',
          'ibc_channel.counterparty_channel_id',
          'ibc_ics20.denom',
          'ibc_ics20.type',
          knex.raw('COUNT(ibc_ics20.id) AS total_messages'),
          knex.raw('SUM(ibc_ics20.amount) AS amount')
        )
        .innerJoin('ibc_channel', function () {
          this.on('ibc_ics20.channel_id', '=', 'ibc_channel.channel_id').andOn(
            'ibc_ics20.status',
            '=',
            knex.raw("'ack_success'")
          );
        })
        .groupBy(
          'ibc_ics20.denom',
          'ibc_ics20.type',
          'ibc_channel.channel_id',
          'ibc_channel.counterparty_channel_id'
        )
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropViewIfExists('view_ibc_channel_detail_statistic');
}

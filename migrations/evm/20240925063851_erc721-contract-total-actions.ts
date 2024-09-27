import { Knex } from 'knex';
import { Erc721Activity } from '../../src/models';
import _ from 'lodash';
import { ERC721_ACTION } from '../../src/services/evm/erc721_handler';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc721_contract', (table) => {
    table.jsonb('total_actions').defaultTo('{}');
  });
  await knex.raw(`set statement_timeout to 0`);
  const [totalTransfer, totalApproval, totalApprovalForAll] = await Promise.all(
    [
      _.keyBy(
        (
          await Erc721Activity.query(knex)
            .where('action', ERC721_ACTION.TRANSFER)
            .groupBy('erc721_activity.erc721_contract_address')
            .select(
              'erc721_activity.erc721_contract_address',
              knex.raw('count(*)::integer as transfer')
            )
        ).map((e) => e.toJSON()),
        'erc721_contract_address'
      ),
      _.keyBy(
        (
          await Erc721Activity.query(knex)
            .where('action', ERC721_ACTION.APPROVAL)
            .groupBy('erc721_activity.erc721_contract_address')
            .select(
              'erc721_activity.erc721_contract_address',
              knex.raw('count(*)::integer as approval')
            )
        ).map((e) => e.toJSON()),
        'erc721_contract_address'
      ),
      _.keyBy(
        (
          await Erc721Activity.query(knex)
            .where('action', ERC721_ACTION.APPROVAL_FOR_ALL)
            .groupBy('erc721_activity.erc721_contract_address')
            .select(
              'erc721_activity.erc721_contract_address',
              knex.raw('count(*)::integer as approval_for_all')
            )
        ).map((e) => e.toJSON()),
        'erc721_contract_address'
      ),
    ]
  );
  const totalAction = _.merge(
    totalTransfer,
    totalApproval,
    totalApprovalForAll
  );
  const erc721ContractsAddr = Object.keys(totalAction);
  if (erc721ContractsAddr.length > 0) {
    const stringListUpdates = erc721ContractsAddr
      .map(
        (addr) =>
          `('${addr}', '${JSON.stringify(
            _.omit(totalAction[addr], 'erc721_contract_address')
          )}'::jsonb)`
      )
      .join(',');
    await knex.raw(
      `UPDATE erc721_contract SET total_actions = temp.total_actions from (VALUES ${stringListUpdates}) as temp(address, total_actions) where temp.address = erc721_contract.address`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc721_contract', (table) => {
    table.dropColumn('total_actions');
  });
}

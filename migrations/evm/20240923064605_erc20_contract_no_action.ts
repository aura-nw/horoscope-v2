import { Knex } from 'knex';
import { Erc20Activity } from '../../src/models';
import { ERC20_ACTION } from '../../src/services/evm/erc20_handler';
import _ from 'lodash';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_contract', (table) => {
    table.jsonb('total_actions').defaultTo('{}');
  });
  await knex.raw(`set statement_timeout to 0`);
  const [totalTransfer, totalApproval, totalDeposit, totalWithdrawal] =
    await Promise.all([
      _.keyBy(
        await Erc20Activity.query(knex)
          .where('action', ERC20_ACTION.TRANSFER)
          .groupBy('erc20_activity.erc20_contract_address')
          .select('erc20_activity.erc20_contract_address')
          .count('* as transfer'),
        'erc20_contract_address'
      ),
      _.keyBy(
        await Erc20Activity.query(knex)
          .where('action', ERC20_ACTION.APPROVAL)
          .groupBy('erc20_activity.erc20_contract_address')
          .select('erc20_activity.erc20_contract_address')
          .count('* as approval'),
        'erc20_contract_address'
      ),
      _.keyBy(
        await Erc20Activity.query(knex)
          .where('action', ERC20_ACTION.DEPOSIT)
          .groupBy('erc20_activity.erc20_contract_address')
          .select('erc20_activity.erc20_contract_address')
          .count('* as deposit'),
        'erc20_contract_address'
      ),
      _.keyBy(
        await Erc20Activity.query(knex)
          .where('action', ERC20_ACTION.WITHDRAWAL)
          .groupBy('erc20_activity.erc20_contract_address')
          .select('erc20_activity.erc20_contract_address')
          .count('* as withdrawal'),
        'erc20_contract_address'
      ),
    ]);
  const totalAction = _.merge(
    totalTransfer,
    totalApproval,
    totalDeposit,
    totalWithdrawal
  );
  const erc20ContractsAddr = Object.keys(totalAction);
  if (erc20ContractsAddr.length > 0) {
    const stringListUpdates = erc20ContractsAddr
      .map(
        (addr) =>
          `('${addr}', '${JSON.stringify(
            _.omit(totalAction[addr], 'erc20_contract_address')
          )}'::jsonb)`
      )
      .join(',');
    await knex.raw(
      `UPDATE erc20_contract SET total_actions = temp.total_actions from (VALUES ${stringListUpdates}) as temp(address, total_actions) where temp.address = erc20_contract.address`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_contract', (table) => {
    table.dropColumn('total_actions');
  });
}

import { Knex } from 'knex';
import stakingAbi from '../../src/services/evm/precompile-abis/staking.json' assert { type: 'json' };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE evm_contract_verification SET abi = '${JSON.stringify(
      stakingAbi
    )}' where contract_address = '0x0000000000000000000000000000000000000800' and status = 'SUCCESS'`
  );
}

export async function down(knex: Knex): Promise<void> {}

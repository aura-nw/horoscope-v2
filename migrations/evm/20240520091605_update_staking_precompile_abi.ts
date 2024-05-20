import { Knex } from 'knex';
import { EVMContractVerification } from '../../src/models';
import stakingAbi from '../../src/services/evm/precompile-abis/staking.json' assert { type: 'json' };

export async function up(knex: Knex): Promise<void> {
  const foundStaking = await EVMContractVerification.query()
    .findOne({
      contract_address: '0x0000000000000000000000000000000000000800',
    })
    .orderBy('id', 'asc');
  if (!foundStaking) {
    throw new Error('Staking contract not found');
  }
  await knex.transaction(async (trx) => {
    await EVMContractVerification.query()
      .patch({
        abi: JSON.stringify(stakingAbi),
      })
      .where('id', foundStaking.id)
      .transacting(trx);
  });
}

export async function down(knex: Knex): Promise<void> {}

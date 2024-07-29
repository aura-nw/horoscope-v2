import _ from 'lodash';
import { EVMContractVerification } from '../../src/models';
import proxy from './abis/proxy.json';
import l1_block from './abis/l1_block.json';
import l2_cross_domain_messenger from './abis/l2_cross_domain_messenger.json';
import l2_standard_bridge from './abis/l2_standard_bridge.json';
import l2_to_l1_message_passer from './abis/l2_to_l1_message_passer.json';

export async function insertContractVerification(_payload: {
  contracts: {
    address: string;
    contractVerification: {
      contractName: string;
      compilerVersion: string;
      abi: any;
      compilerSetting: any;
    };
  }[];
}) {
  console.log('Inserting contract verification');
  const foundContracts = await EVMContractVerification.query()
    .whereIn(
      'contract_address',
      _payload.contracts.map((contract) => contract.address)
    )
    .select('id', 'contract_address');
  if (foundContracts.length > 0) {
    console.error(`Found contracts in DB: ${JSON.stringify(foundContracts)}`);
    return;
  }
  const foundContractByAddress = _.keyBy(foundContracts, 'contract_address');
  const newContracts = _payload.contracts.filter(
    (contract) => !foundContractByAddress[contract.address]
  );
  const evmContractVerification = newContracts.map((contract) =>
    EVMContractVerification.fromJson({
      contract_address: contract.address,
      abi: JSON.stringify(contract.contractVerification.abi),
      compiler_setting: JSON.stringify(
        contract.contractVerification.compilerSetting
      ),
      contract_name: contract.contractVerification.contractName,
      status: EVMContractVerification.VERIFICATION_STATUS.SUCCESS,
    })
  );
  await EVMContractVerification.query().insert(evmContractVerification);
  console.log('Inserted done contract verification');
}

const opContracts = [
  [
    '0x4200000000000000000000000000000000000007',
    '0x4200000000000000000000000000000000000010',
    '0x4200000000000000000000000000000000000015',
    '0x4200000000000000000000000000000000000016',
  ].map((address) => ({
    address,
    contractVerification: proxy,
  })),
  {
    address: '0xc0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d30007',
    contractVerification: l2_cross_domain_messenger,
  },
  {
    address: '0xc0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d30010',
    contractVerification: l2_standard_bridge,
  },
  {
    address: '0x07dbe8500fc591d1852b76fee44d5a05e13097ff',
    contractVerification: l1_block,
  },
  {
    address: '0xc0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d30016',
    contractVerification: l2_to_l1_message_passer,
  },
].flat();

insertContractVerification({ contracts: opContracts });

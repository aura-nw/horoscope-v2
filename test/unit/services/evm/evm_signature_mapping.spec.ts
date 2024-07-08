import {
  AfterAll,
  AfterEach,
  BeforeAll,
  BeforeEach,
  Describe,
  Test,
} from '@jest-decorated/core';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import {
  EVMContractVerification,
  EvmSignatureMapping,
} from '../../../../src/models';
import EvmSignatureMappingJob from '../../../../src/services/evm/evm_signature_mapping.service';

@Describe('Test EvmSignatureMappingService')
export default class TestEvmSignatureMappingService {
  broker = new ServiceBroker({ logger: false });

  evmSignatureMappingJob!: EvmSignatureMappingJob;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    this.evmSignatureMappingJob = this.broker.createService(
      EvmSignatureMappingJob
    ) as EvmSignatureMappingJob;
  }

  @BeforeEach()
  async beforeEach() {
    await knex.raw(
      'TRUNCATE TABLE evm_contract_verification RESTART IDENTITY CASCADE'
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @AfterEach()
  async afterEach() {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('Test handle evm signature mapping case success')
  async testHandleEvmSignatureMapping() {
    const abi = [
      {
        name: 'bech32ToHex',
        type: 'function',
        inputs: [
          {
            name: 'bech32Address',
            type: 'string',
            internalType: 'string',
          },
        ],
        outputs: [
          {
            name: 'addr',
            type: 'address',
            internalType: 'address',
          },
        ],
        stateMutability: 'nonpayable',
      },
      {
        name: 'hexToBech32',
        type: 'function',
        inputs: [
          {
            name: 'addr',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'prefix',
            type: 'string',
            internalType: 'string',
          },
        ],
        outputs: [
          {
            name: 'bech32Address',
            type: 'string',
            internalType: 'string',
          },
        ],
        stateMutability: 'nonpayable',
      },
      {
        type: 'constructor',
        inputs: [
          {
            name: '_logic',
            type: 'address',
            internalType: 'address',
          },
          {
            name: '_data',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
        outputs: [
          {
            name: 'addr',
            type: 'address',
            internalType: 'address',
          },
        ],
        stateMutability: 'payable',
      },
    ];
    const contractVerification = EVMContractVerification.fromJson({
      abi: JSON.stringify(abi),
      code_hash: null,
      compile_detail: null,
      compiler_setting: null,
      compiler_version: null,
      contract_address: '0x0000000000000000000000000000000000000400',
      contract_name: null,
      created_at: null,
      creator_tx_hash: null,
      status: 'SUCCESS',
      updated_at: null,
      id: 1,
    });
    await EVMContractVerification.query().insert(contractVerification);
    await this.evmSignatureMappingJob.handler({
      contract_address: contractVerification.contract_address,
    });
    const results = _.keyBy(await EvmSignatureMapping.query(), 'topic_hash');
    expect(Object.keys(results).length).toEqual(abi.length);
    expect(
      results[
        '0xe6df461e3eb932bcab5e3c438decb7bdd77802f21f556581f0e76580e7d5472a'
      ].human_readable_topic
    ).toEqual(
      `${abi[0].type} ${abi[0].name}(${abi[0].inputs[0].type} ${abi[0].inputs[0].name}) returns (${abi[0].outputs[0].type} ${abi[0].outputs[0].name})`
    );
    expect(
      results[
        '0xf958a98c15ea26fb9392f1095ed5228948dc6763b0053117328ab9e44f58a887'
      ].human_readable_topic
    ).toEqual(
      `${abi[1].type} ${abi[1].name}(${abi[1].inputs[0].type} ${abi[1].inputs[0].name}, ${abi[1].inputs[1].type} ${abi[1].inputs[1].name}) returns (${abi[1].outputs[0].type} ${abi[1].outputs[0].name})`
    );
    expect(
      results[
        '0x4531ea10d9d3b3f7400c1966bf9b04086c85b71740828ba0618515e90935ffd3'
      ].human_readable_topic
    ).toEqual(
      `constructor(${abi[2].inputs[0].type} ${abi[2].inputs[0].name}, ${abi[2].inputs[1].type} ${abi[2].inputs[1].name})`
    );
  }

  @Test('Test handle evm signature mapping case not verified contract')
  async testHandleEvmSignatureMappingCaseNotVerified() {
    const unverifiedContract = '0x5C80c59E6920DD802412cc40B8Da9dc2a5f5343a';
    const result = jest.spyOn(this.evmSignatureMappingJob.logger, 'info');
    await this.evmSignatureMappingJob.handler({
      contract_address: unverifiedContract,
    });
    expect(result).toHaveBeenCalledWith(
      `No contract verified found for this contract address ${unverifiedContract}!`
    );
  }
}

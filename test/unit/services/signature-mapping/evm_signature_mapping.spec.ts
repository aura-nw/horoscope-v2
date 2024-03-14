import { BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import { EvmSignatureMapping } from '../../../../src/models';
import EvmSignatureMappingJob from '../../../../src/services/verify-contract-evm/evm_signature_mapping.service';
import { abi } from './abi';

@Describe('Test Evm Signature Mapping')
export default class EvmSignatureMappingSpec {
  broker = new ServiceBroker({ logger: false });

  evmSignatureMappingJob?: EvmSignatureMappingJob;

  @BeforeAll()
  async initSuite() {
    await knex.raw(`
      TRUNCATE TABLE ${EvmSignatureMapping.tableName} RESTART IDENTITY CASCADE;
    `);
    this.evmSignatureMappingJob = this.broker.createService(
      EvmSignatureMappingJob
    ) as EvmSignatureMappingJob;
  }

  @Test('Test minimal human readable abi mapping with topic hash')
  public async test1() {
    const humanReadableABI = 'Transfer(address,address,uint256)';
    const topicExpected =
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const topicHashed =
      this.evmSignatureMappingJob?.getTopicHash(humanReadableABI);
    expect(topicHashed).toBe(topicExpected);
  }

  @Test('Test full human readable abi mapping with topic hash')
  public async test2() {
    const humanReadableABI =
      'Transfer (index_topic_1 address _from, index_topic_2 address _to, index_topic_3 uint256 _tokenId)';
    const topicExpected =
      '0x53d37e7938c45edc72a19157c2065a549b2d702fb803e2c9eb28ba387456dab5';
    const topicHashed =
      this.evmSignatureMappingJob?.getTopicHash(humanReadableABI);
    expect(topicHashed).toBe(topicExpected);
  }

  @Test('Test extract human readable signature from ABI')
  public async test3() {
    const signatures =
      await this.evmSignatureMappingJob?.convertABIToHumanReadable(abi);
    expect(signatures?.fullFragments.length).toBe(abi.length);
    expect(signatures?.sigHashFragments.length).toBe(abi.length);
  }
}

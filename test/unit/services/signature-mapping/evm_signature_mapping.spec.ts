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

  @Test('Test signature mapping Transfer event')
  public async test1() {
    const ABI = abi.filter((e) => e.type === 'event' && e.name === 'Transfer');
    const topicExpected = [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    ];
    const EVMSignatureMapping =
      await this.evmSignatureMappingJob?.mappingContractTopic(ABI);

    EVMSignatureMapping?.forEach((signatureMapping, index) => {
      expect(signatureMapping.topic_hash).toBe(topicExpected[index]);
    });
  }

  @Test('Test signature mapping OwnershipTransferred event')
  public async test2() {
    const ABI = abi.filter(
      (e) => e.type === 'event' && e.name === 'OwnershipTransferred'
    );
    const topicExpected = [
      '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0',
    ];
    const EVMSignatureMapping =
      await this.evmSignatureMappingJob?.mappingContractTopic(ABI);

    EVMSignatureMapping?.forEach((signatureMapping, index) => {
      expect(signatureMapping.topic_hash).toBe(topicExpected[index]);
    });
  }
}

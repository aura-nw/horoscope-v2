import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { ethers } from 'ethers';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import { EvmSignatureMapping } from '../../models';

@Service({
  name: SERVICE.V1.SignatureMappingEVM.key,
  version: 1,
})
export default class EvmSignatureMappingJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public async convertABIToHumanReadable(ABI: any[]): Promise<string[]> {
    const iface = new ethers.Interface(ABI);
    return iface.format();
  }

  public getTopicHash(topicSignature: string): string {
    return ethers.id(topicSignature);
  }

  public async mappingContractTopic(contractVerified: any): Promise<void> {
    const topics = await this.convertABIToHumanReadable(contractVerified.abi);
    const topicsHashed: EvmSignatureMapping[] = topics.map((topic) =>
      EvmSignatureMapping.fromJson({
        topicHashed: this.getTopicHash(topic),
        readableTopic: topic,
      })
    );
    await EvmSignatureMapping.query()
      .insert(topicsHashed)
      .onConflict('topic_hash')
      .merge();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
    jobName: BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
    concurrency: config.jobCrawlEvmEvent.concurrencyHandle,
  })
  async handler(): Promise<void> {
    const contractVerified: never[] = [];

    if (!contractVerified) {
      this.logger.info('No contract verified found for this contract address!');
    }

    await this.mappingContractTopic(contractVerified);
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
      BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
      {},
      {
        jobId: BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleSignatureMappingEvm.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

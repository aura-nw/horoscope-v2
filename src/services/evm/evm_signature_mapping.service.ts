import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { ethers } from 'ethers';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, IAddressesParam, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import { EVMContractVerification, EvmSignatureMapping } from '../../models';

@Service({
  name: SERVICE.V1.SignatureMappingEVM.key,
  version: 1,
})
export default class EvmSignatureMappingJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public async convertABIToHumanReadable(ABI: any[]): Promise<{
    fullFragments: string[];
    sigHashFragments: string[];
  }> {
    const iface = new ethers.Interface(ABI);
    const fullFragments = iface.format();
    const sigHashFragments = iface.fragments.map((f) => {
      if (f.type === 'constructor') return f.format('minimal');
      return f.format('sighash');
    });
    return {
      fullFragments,
      sigHashFragments,
    };
  }

  public async mappingContractTopic(
    ABI: any[]
  ): Promise<EvmSignatureMapping[]> {
    const convertedTopics = await this.convertABIToHumanReadable(ABI);
    const signatureMappings: EvmSignatureMapping[] =
      convertedTopics.sigHashFragments.map((topic, index) =>
        EvmSignatureMapping.fromJson({
          topic_hash: ethers.id(topic),
          human_readable_topic: convertedTopics.fullFragments[index],
        })
      );
    return EvmSignatureMapping.query()
      .insert(signatureMappings)
      .onConflict('topic_hash')
      .merge();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
    jobName: BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
    concurrency: config.jobCrawlEvmEvent.concurrencyHandle,
  })
  async handler(_payload: { contract_address: string }): Promise<void> {
    const contractVerified = await EVMContractVerification.query()
      .findOne('contract_address', _payload.contract_address)
      .limit(1);

    if (!contractVerified) {
      this.logger.info(
        `No contract verified found for this contract address ${_payload.contract_address}!`
      );
      return;
    }

    await this.mappingContractTopic(contractVerified.abi);
    this.logger.info(
      `Successfully mapping for contract with address ${contractVerified.contract_address}`
    );
  }

  @Action({
    name: SERVICE.V1.SignatureMappingEVM.action.key,
    params: {
      addresses: 'string[]',
    },
  })
  public async createJobMapping(ctx: Context<IAddressesParam>): Promise<void> {
    const promises: any[] = [];
    ctx.params.addresses.forEach((address) => {
      promises.push(
        this.createJob(
          BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
          BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
          {
            contract_address: address,
          },
          {
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        )
      );
    });
    await Promise.all(promises);
  }

  public async _start(): Promise<void> {
    // this.createJob(
    //   BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
    //   BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
    //   {
    //     contract_address: '0xb4d3388f0cce7cd394e4e4d19e036bc9df86b373',
    //   },
    //   {
    //     jobId: BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
    //     removeOnComplete: true,
    //     removeOnFail: {
    //       count: 3,
    //     },
    //   }
    // );
    return super._start();
  }
}
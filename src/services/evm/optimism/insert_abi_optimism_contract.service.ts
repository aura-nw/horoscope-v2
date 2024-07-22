import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { hashMessage } from 'viem';
import { SERVICE, BULL_JOB_NAME } from '../constant';
import BullableService from '../../../base/bullable.service';
import proxy from './abis/proxy.json';
import l1_block from './abis/l1_block.json';
import l2_cross_domain_messenger from './abis/l2_cross_domain_messenger.json';
import l2_standard_bridge from './abis/l2_standard_bridge.json';
import l2_to_l1_message_passer from './abis/l2_to_l1_message_passer.json';

@Service({
  name: SERVICE.V1.InsertOptimismContractVerification.key,
  version: 1,
})
export default class InsertOptimismContractVerificationService extends BullableService {
  async _start(): Promise<void> {
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
    this.createJob(
      BULL_JOB_NAME.INSERT_CONTRACT_VERIFICATION,
      BULL_JOB_NAME.INSERT_CONTRACT_VERIFICATION,
      {
        contracts: opContracts,
      },
      {
        jobId: hashMessage(
          opContracts.map((contract) => contract.address).join()
        ),
        removeOnFail: {
          count: 3,
        },
      }
    );
    return super._start();
  }
}

import _ from 'lodash';
import { ethers } from 'ethers';
import {
  EIPProxyContractSupportByteCode,
  DetectEVMProxyContract,
  EVM_PREFIX,
  NULL_BYTE_CODE,
  EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH,
  ZERO_ADDRESS,
} from '../constant';

export class ContractHelper {
  private etherJsClient: ethers.AbstractProvider;

  constructor(etherJsClient: ethers.AbstractProvider) {
    this.etherJsClient = etherJsClient;
  }

  public async detectProxyContractByByteCode(
    contractAddress: string,
    byteCode: string,
    byteCodeSlot: string,
    blockHeight?: number | string
  ): Promise<DetectEVMProxyContract> {
    const resultReturn: DetectEVMProxyContract = {
      logicContractAddress: '',
      EIP: '',
    };
    const result = byteCode.includes(byteCodeSlot);

    if (!result) throw Error('Not proxy contract!');

    const storageSlotValue = await this.etherJsClient.getStorage(
      contractAddress,
      `${EVM_PREFIX}${byteCodeSlot}`,
      blockHeight || 'latest'
    );

    if (storageSlotValue === '0x' || storageSlotValue === NULL_BYTE_CODE)
      throw Error('Invalid contract address!');

    const logicAddress =
      storageSlotValue.length === EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH
        ? `${EVM_PREFIX}${storageSlotValue.slice(-40)}`
        : storageSlotValue;

    if (logicAddress === ZERO_ADDRESS) throw Error('Zero contract detected!');

    resultReturn.logicContractAddress = logicAddress;
    resultReturn.EIP = _.find(
      EIPProxyContractSupportByteCode,
      (val) => val.SLOT === byteCodeSlot
    )?.TYPE;
    return resultReturn;
  }

  // Detect contract is proxy contract or not
  public async isContractProxy(
    contractAddress: string,
    blockHeight?: number | string,
    byteCodeSlot?: string
  ): Promise<DetectEVMProxyContract | null> {
    const byteCode = await this.etherJsClient.getCode(contractAddress);
    let result: DetectEVMProxyContract | null;

    try {
      if (byteCodeSlot) {
        result = await this.detectProxyContractByByteCode(
          contractAddress,
          byteCode,
          byteCodeSlot,
          blockHeight
        );
      } else {
        result = await Promise.any([
          // this.detectProxyContractByByteCode(
          //   contractAddress,
          //   byteCode,
          //   EIPProxyContractSupportByteCode.EIP_1967_ADMIN.SLOT,
          //   blockHeight
          // ),
          this.detectProxyContractByByteCode(
            contractAddress,
            byteCode,
            EIPProxyContractSupportByteCode.EIP_1967_IMPLEMENTATION.SLOT,
            blockHeight
          ),
          // TODO: support beacon soon.
          // this.detectProxyContractByByteCode(
          //   contractAddress,
          //   byteCode,
          //   EIPProxyContractSupportByteCode.EIP_1967_BEACON.SLOT,
          //   blockHeight
          // ),
          this.detectProxyContractByByteCode(
            contractAddress,
            byteCode,
            EIPProxyContractSupportByteCode.EIP_1822_IMPLEMENTATION.SLOT,
            blockHeight
          ),
          this.detectProxyContractByByteCode(
            contractAddress,
            byteCode,
            EIPProxyContractSupportByteCode.OPEN_ZEPPELIN_IMPLEMENTATION.SLOT,
            blockHeight
          ),
        ]);
      }
    } catch (error) {
      result = null;
    }

    return result;
  }
}

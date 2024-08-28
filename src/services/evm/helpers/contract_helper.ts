import _ from 'lodash';
import { PublicClient } from 'viem';
import '../../../../fetch-polyfill.js';
import {
  DetectEVMProxyContract,
  EIPProxyContractSupportByteCode,
  EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH,
  EVM_PREFIX,
  NULL_BYTE_CODE,
  ZERO_ADDRESS,
} from '../constant';

export class ContractHelper {
  private viemClient: PublicClient;

  constructor(viemClient: PublicClient) {
    this.viemClient = viemClient;
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
    const eip = _.find(
      EIPProxyContractSupportByteCode,
      (val) => val.SLOT === byteCodeSlot
    )?.TYPE;
    let logicAddress = '';
    if (eip === EIPProxyContractSupportByteCode.EIP_1167_IMPLEMENTATION.TYPE) {
      logicAddress = `0x${byteCode.slice(22, 62)}`;
    } else {
      const storageSlotValue = await this.viemClient.getStorageAt({
        address: contractAddress as `0x${string}`,
        slot: `${EVM_PREFIX}${byteCodeSlot}`,
        blockNumber: blockHeight ? BigInt(blockHeight) : undefined,
      });
      if (
        storageSlotValue === '0x' ||
        storageSlotValue === NULL_BYTE_CODE ||
        storageSlotValue === undefined
      )
        throw Error('Invalid contract address!');

      logicAddress =
        storageSlotValue.length === EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH
          ? `${EVM_PREFIX}${storageSlotValue.slice(-40)}`
          : storageSlotValue;

      if (logicAddress === ZERO_ADDRESS) throw Error('Zero contract detected!');
    }
    resultReturn.logicContractAddress = logicAddress;
    resultReturn.EIP = eip;
    return resultReturn;
  }

  // Detect contract is proxy contract or not
  public async isContractProxy(
    contractAddress: string,
    blockHeight?: number | string,
    byteCodeSlot?: string,
    bytecode?: string
  ): Promise<DetectEVMProxyContract | null> {
    const byteCode =
      bytecode ||
      (await this.viemClient.getBytecode({
        address: contractAddress as `0x${string}`,
      }));
    let result: DetectEVMProxyContract | null;
    if (!byteCode) {
      return null;
    }
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
          this.detectProxyContractByByteCode(
            contractAddress,
            byteCode,
            EIPProxyContractSupportByteCode.EIP_1167_IMPLEMENTATION.SLOT
          ),
        ]);
      }
    } catch (error) {
      result = null;
    }

    return result;
  }
}

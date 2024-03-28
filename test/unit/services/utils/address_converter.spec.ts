import { Describe, Test } from '@jest-decorated/core';
import {
  convertBech32AddressToEthAddress,
  convertEthAddressToBech32Address,
} from '../../../../src/services/evm/utils';

@Describe('Test util address_converter')
export default class TestAddressConverterService {
  @Test('Test convert bech32 address to eth address')
  public testConvertBech32AddressToEthAddress() {
    const evmosAddress = 'evmos1dvggkfyuzaeefllm0256e9dyu2t0943l9k55cf';
    const ethAddress = convertBech32AddressToEthAddress('evmos', evmosAddress);
    expect(ethAddress).toEqual('0x6b108B249C177394fffb7Aa9AC95A4e296f2d63f');
  }

  @Test('Test convert eth address to bech32 address')
  public testConvertEthAddressToBech32Address() {
    const ethAddress = '0x6b108b249c177394fffb7aa9ac95a4e296f2d63f';
    const evmosAddress = convertEthAddressToBech32Address('evmos', ethAddress);
    expect(evmosAddress).toEqual(
      'evmos1dvggkfyuzaeefllm0256e9dyu2t0943l9k55cf'
    );

    const ethAddress2 = '0x16c2f32269D12969456D8a2b362341Dd470b65f6';
    const auraAddress = convertEthAddressToBech32Address('aura', ethAddress2);
    expect(auraAddress).toEqual('aura1zmp0xgnf6y5kj3td3g4nvg6pm4rske0kyhahhp');
  }
}

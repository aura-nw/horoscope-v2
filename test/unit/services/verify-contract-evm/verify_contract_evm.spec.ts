import { BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import fs from 'fs';
import path from 'path';
import { SolidityCompiler } from '../../../../src/services/handle-tx-evm/solidity_compiler';
import VerifyContractEVM from '../../../../src/services/handle-tx-evm/verify_contract_evm.service';
// import expectedCompileErc721 from './expected_compile_erc721.json';
import expectedCompileStorage from './expected_compile_storage.json';
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = new URL('.', import.meta.url).pathname;
@Describe('Test verify contract evm')
export default class VerifyContractEVMTest {
  broker = new ServiceBroker({ logger: false });

  verifyContractEVMService = this.broker.createService(
    VerifyContractEVM
  ) as VerifyContractEVM;

  erc721Contract: any;

  storageContract: any;

  @BeforeEach()
  async initSuite() {
    this.erc721Contract = fs.readFileSync(
      path.resolve(__dirname, './erc721.zip')
    );
    this.storageContract = fs.readFileSync(
      path.resolve(__dirname, './storage.zip')
    );
    this.verifyContractEVMService.getQueueManager().stopAll();
  }

  @Test('Test compile contract evm')
  async verifyContractEVM() {
    const solidityCompiler = new SolidityCompiler(this.broker.logger);
    // const erc721File = [
    //   {
    //     path: 'erc721',
    //     buffer: this.erc721Contract,
    //   },
    // ];
    // const contractERC721 = await this.verifyContractEVMService.checkFiles(
    //   solidityCompiler,
    //   erc721File
    // );
    // const recompiledERC721 = await contractERC721[0].recompile();
    // expect(recompiledERC721.creationBytecode).toEqual(
    //   expectedCompileErc721.creationBytecode
    // );
    // expect(JSON.stringify(JSON.parse(recompiledERC721.metadata))).toEqual(
    //   JSON.stringify(expectedCompileErc721.metadata)
    // );
    // expect(recompiledERC721.runtimeBytecode).toEqual(
    //   expectedCompileErc721.runtimeBytecode
    // );
    const storageFile = [
      {
        path: 'storage',
        buffer: this.storageContract,
      },
    ];
    const contractStorage = await this.verifyContractEVMService.checkFiles(
      solidityCompiler,
      storageFile
    );

    const recompiledStorage = await contractStorage[0].recompile();
    expect(recompiledStorage.creationBytecode).toEqual(
      expectedCompileStorage.creationBytecode
    );
    expect(recompiledStorage.metadata).toEqual(
      JSON.stringify(expectedCompileStorage.metadata)
    );
    expect(recompiledStorage.runtimeBytecode).toEqual(
      expectedCompileStorage.runtimeBytecode
    );
  }
}

/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import pkg, {
  CheckedContract,
  ISolidityCompiler,
  InvalidSources,
  MissingSources,
  PathBuffer,
  PathContent,
  StringMap,
  extractHardhatMetadataAndSources,
  storeByHash,
  verifyDeployed,
  unzipFiles,
} from '@ethereum-sourcify/lib-sourcify';
import { id as keccak256str, keccak256 } from 'ethers';
import { createHash } from 'crypto';
import { lt } from 'semver';
import { BlockCheckpoint, EVMContractVerification } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import { SolidityCompiler } from './solidity_compiler';
import networks from '../../../network.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

const HARDHAT_OUTPUT_FORMAT_REGEX = /"hh-sol-build-info-1"/;
const NESTED_METADATA_REGEX =
  /"{\\"compiler\\":{\\"version\\".*?},\\"version\\":1}"/;
@Service({
  name: SERVICE.V1.VerifyContractEVM.key,
  version: 1,
})
export default class VerifyContractEVM extends BullableService {
  private _sourcifyChain!: pkg.SourcifyChain;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.VERIFY_CONTRACT_EVM,
    jobName: BULL_JOB_NAME.VERIFY_CONTRACT_EVM,
  })
  async verifyContractEVM() {
    const listRequestVerify = await EVMContractVerification.query()
      .where('status', EVMContractVerification.VERIFICATION_STATUS.PENDING)
      .limit(config.jobVerifyContractEVM.recordsPerCall)
      .orderBy('id');
    if (listRequestVerify.length === 0) {
      return;
    }
    const selectedSolidityCompiler: ISolidityCompiler = new SolidityCompiler(
      this.logger
    );

    await knex.transaction(async (trx) => {
      const listPromise = [];
      for (let i = 0; i < listRequestVerify.length; i += 1) {
        const requestVerify = listRequestVerify[i];
        let codeHash;
        try {
          if (this.isZip(requestVerify.files)) {
            const files = [
              {
                path: requestVerify.id.toString(),
                buffer: requestVerify.files,
              },
            ];
            const unused: string[] = [];
            const contracts = await this.checkFiles(
              selectedSolidityCompiler,
              files,
              unused
            );

            // verify this contracts
            for (let j = 0; j < contracts.length; j += 1) {
              const contract = contracts[j];
              const matchResult = await verifyDeployed(
                contract,
                this._sourcifyChain,
                requestVerify.contract_address
              );

              let useEmscripten = false;
              // See https://github.com/ethereum/sourcify/issues/1159
              // The nightlies and pre-0.4.10 platform binaries are not available
              if (
                lt(contract.metadata.compiler.version, '0.4.10') ||
                contract.metadata.compiler.version.includes('nightly')
              ) {
                useEmscripten = true;
              }
              const recompiled = await contract.recompile(useEmscripten);
              const metadata = JSON.parse(recompiled.metadata);
              const { abi } = metadata.output;
              this.logger.info(matchResult);
              this.logger.info(abi);
              codeHash = keccak256(recompiled.runtimeBytecode);
              if (matchResult.runtimeMatch === 'perfect') {
                listPromise.push(
                  EVMContractVerification.query()
                    .patch({
                      abi: JSON.stringify(abi),
                      code_hash: codeHash,
                      status:
                        EVMContractVerification.VERIFICATION_STATUS.SUCCESS,
                    })
                    .where({ id: requestVerify.id })
                    .transacting(trx)
                );
              } else {
                throw Error(matchResult.message);
              }
            }
          } else {
            throw Error('this is not zip file');
          }
        } catch (error) {
          this.logger.error(error);
          listPromise.push(
            EVMContractVerification.query()
              .patch({
                code_hash: codeHash,
                status: EVMContractVerification.VERIFICATION_STATUS.FAIL,
              })
              .where({ id: requestVerify.id })
              .transacting(trx)
          );
        }
      }
      await Promise.all(listPromise);
      await BlockCheckpoint.query()
        .insert({
          job_name: BULL_JOB_NAME.VERIFY_CONTRACT_EVM,
          height: listRequestVerify[listRequestVerify.length - 1].id,
        })
        .onConflict(['job_name'])
        .merge()
        .transacting(trx);
    });
  }

  @Action({
    name: SERVICE.V1.VerifyContractEVM.inputRequestVerify.key,
  })
  public async actionCreateJob(ctx: Context<any>) {
    const requestVerify = EVMContractVerification.fromJson({
      contract_address: ctx.params.contract_address,
      files: Buffer.from(ctx.params.files),
      creator_tx_hash: ctx.params.creator_tx_hash,
      status: EVMContractVerification.VERIFICATION_STATUS.PENDING,
    });
    const response = await EVMContractVerification.query().insert(
      requestVerify
    );
    return response;
  }

  async _start(): Promise<void> {
    const selectedChain = networks.find(
      (network) => network.chainId === config.chainId
    );
    if (
      !selectedChain ||
      !selectedChain.EVMchainId ||
      !selectedChain.EVMJSONRPC
    ) {
      this.logger.error(
        'Cannot found chain EVM with chainId: ',
        config.chainId
      );
      return;
    }
    this._sourcifyChain = new pkg.SourcifyChain({
      chainId: selectedChain.EVMchainId,
      name: config.chainName,
      rpc: selectedChain.EVMJSONRPC,
      supported: true,
    });
    this.createJob(
      BULL_JOB_NAME.VERIFY_CONTRACT_EVM,
      BULL_JOB_NAME.VERIFY_CONTRACT_EVM,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobVerifyContractEVM.millisecondCrawl,
        },
      }
    );
    // eslint-disable-next-line consistent-return
    return super._start();
  }

  async checkFiles(
    solidityCompiler: ISolidityCompiler,
    files: PathBuffer[],
    unused?: string[]
  ) {
    await unzipFiles(files);
    const parsedFiles = files.map((pathBuffer) => ({
      content: pathBuffer.buffer.toString(),
      path: pathBuffer.path,
    }));
    const { metadataFiles, sourceFiles } = this.splitFiles(parsedFiles);
    const checkedContracts: CheckedContract[] = [];
    const byHash = storeByHash(sourceFiles);
    const usedFiles: string[] = [];

    metadataFiles.forEach((metadata) => {
      const {
        foundSources,
        missingSources,
        invalidSources,
        metadata2provided,
      } = this.rearrangeSources(metadata, byHash);
      const currentUsedFiles = Object.values(metadata2provided);
      usedFiles.push(...currentUsedFiles);
      const checkedContract = new CheckedContract(
        solidityCompiler,
        metadata,
        foundSources,
        missingSources,
        invalidSources
      );
      checkedContracts.push(checkedContract);
    });
    if (unused) {
      this.extractUnused(sourceFiles, usedFiles, unused);
    }
    return checkedContracts;
  }

  splitFiles(files: PathContent[]): {
    metadataFiles: any[];
    sourceFiles: PathContent[];
  } {
    const metadataFiles = [];
    const sourceFiles: PathContent[] = [];
    const malformedMetadataFiles = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const file of files) {
      // If hardhat output file, extract source and metadatas.
      if (file.content.match(HARDHAT_OUTPUT_FORMAT_REGEX)) {
        const { hardhatMetadataFiles, hardhatSourceFiles } =
          extractHardhatMetadataAndSources(file);
        sourceFiles.push(...hardhatSourceFiles);
        metadataFiles.push(...hardhatMetadataFiles);
        // eslint-disable-next-line no-continue
        continue;
      }

      let metadata = this.extractMetadataFromString(file.content);
      if (!metadata) {
        const matchRes = file.content.match(NESTED_METADATA_REGEX);
        if (matchRes) {
          metadata = this.extractMetadataFromString(matchRes[0]);
        }
      }

      if (metadata) {
        try {
          this.assertObjectSize(metadata.settings.compilationTarget, 1);
          metadataFiles.push(metadata);
        } catch (err) {
          malformedMetadataFiles.push(file.path);
        }
      } else {
        sourceFiles.push(file);
      }
    }

    let msg = '';
    if (malformedMetadataFiles.length) {
      const responsibleFiles = malformedMetadataFiles.every(Boolean)
        ? malformedMetadataFiles.join(', ')
        : `${malformedMetadataFiles.length} metadata files`;
      msg = `Couldn't parse metadata files or they are malformed. Can't find settings.compilationTarget or multiple compilationTargets in: ${responsibleFiles}`;
    } else if (!metadataFiles.length) {
      msg = 'Metadata file not found. Did you include "metadata.json"?';
    }

    if (msg) {
      const error = new Error(msg);
      throw error;
    }

    return { metadataFiles, sourceFiles };
  }

  assertObjectSize(object: any, expectedSize: number) {
    let err = '';

    if (!object) {
      err = `Cannot assert for ${object}.`;
    } else {
      const objectSize = Object.keys(object).length;
      if (objectSize !== expectedSize) {
        err = `Error in size assertion! Actual size: ${objectSize}. Expected size: ${expectedSize}.`;
      }
    }

    if (err) {
      const error = new Error(err);
      throw error;
    }
  }

  extractMetadataFromString(file: string): any {
    try {
      let obj = JSON.parse(file);
      if (this.isMetadata(obj)) {
        return obj;
      }

      // if the input string originates from a file where it was double encoded (e.g. truffle)
      obj = JSON.parse(obj);
      if (this.isMetadata(obj)) {
        return obj;
      }
    } catch (err) {
      this.logger.debug(err);
    } // Don't throw here as other files can be metadata files.

    return null;
  }

  isMetadata(obj: any): boolean {
    return (
      obj?.language === 'Solidity' &&
      !!obj?.settings?.compilationTarget &&
      !!obj?.version &&
      !!obj?.output?.abi &&
      !!obj?.output?.userdoc &&
      !!obj?.output?.devdoc &&
      !!obj?.sources
    );
  }

  isZip(file: any): boolean {
    // How is-zip-file checks https://github.com/luthraG/is-zip-file/blob/master/index.js
    // Also according to this: https://stackoverflow.com/a/18194946/6528944
    const response =
      file[0] === 0x50 &&
      file[1] === 0x4b &&
      (file[2] === 0x03 || file[2] === 0x05 || file[2] === 0x07) &&
      (file[3] === 0x04 || file[3] === 0x06 || file[3] === 0x08);
    return response;
  }

  pathContentArrayToStringMap(pathContentArr: PathContent[]) {
    const stringMapResult: StringMap = {};
    pathContentArr.forEach((elem, i) => {
      if (elem.path) {
        stringMapResult[elem.path] = elem.content;
      } else {
        stringMapResult[`path-${i}`] = elem.content;
      }
    });
    return stringMapResult;
  }

  rearrangeSources(metadata: any, byHash: Map<string, PathContent>) {
    const foundSources: StringMap = {};
    const missingSources: MissingSources = {};
    const invalidSources: InvalidSources = {};
    const metadata2provided: StringMap = {}; // maps fileName as in metadata to the fileName of the provided file

    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const sourcePath in metadata.sources) {
      const sourceInfoFromMetadata = metadata.sources[sourcePath];
      let file: PathContent | undefined;
      const expectedHash: string = sourceInfoFromMetadata.keccak256;
      if (sourceInfoFromMetadata.content) {
        // Source content already in metadata
        file = {
          content: sourceInfoFromMetadata.content,
          path: sourcePath,
        };
        const contentHash = keccak256str(file.content);
        if (contentHash !== expectedHash) {
          invalidSources[sourcePath] = {
            expectedHash,
            calculatedHash: contentHash,
            msg: "The keccak256 given in the metadata and the calculated keccak256 of the source content in metadata don't match",
          };
          // eslint-disable-next-line no-continue
          continue;
        }
      } else {
        // Get source from input files by hash
        const pathContent = byHash.get(expectedHash);
        if (pathContent) {
          file = pathContent;
          metadata2provided[sourcePath] = pathContent.path;
        } // else: no file has the hash that was searched for
      }

      if (file && file.content) {
        foundSources[sourcePath] = file.content;
      } else {
        missingSources[sourcePath] = {
          keccak256: expectedHash,
          urls: sourceInfoFromMetadata.urls,
        };
      }
    }

    return { foundSources, missingSources, invalidSources, metadata2provided };
  }

  extractUnused(
    inputFiles: PathContent[],
    usedFiles: string[],
    unused: string[]
  ): void {
    const usedFilesSet = new Set(usedFiles);
    const tmpUnused = inputFiles
      .map((pc) => pc.path)
      .filter((file) => !usedFilesSet.has(file));
    unused.push(...tmpUnused);
  }

  generateId(obj: any): string {
    const objString = JSON.stringify(obj);
    const hash = createHash('sha1').update(objString).digest('hex');
    return hash;
  }
}

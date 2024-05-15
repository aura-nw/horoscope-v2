/* eslint-disable no-else-return */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import _ from 'lodash';
import { SourcifyMatch } from '../../../models/sourcify';
import { BlockCheckpoint, EVMContractVerification } from '../../../models';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import config from '../../../../config.json' assert { type: 'json' };
import { SERVICE, BULL_JOB_NAME } from '../constant';
import networks from '../../../../network.json' assert { type: 'json' };
import knex from '../../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.JobService.SyncSourcify.key,
  version: 1,
})
export default class SyncSourcify extends BullableService {
  @QueueHandler({
    queueName: BULL_JOB_NAME.SYNC_SOURCIFY,
    jobName: BULL_JOB_NAME.SYNC_SOURCIFY,
  })
  async syncSourcify() {
    const currentChain = networks.find(
      (network) => network.chainId === config.chainId
    );
    if (!currentChain || !currentChain.EVMchainId) {
      this.logger.error('This EVM Chain ID not found');
      return;
    }
    let blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.SYNC_SOURCIFY,
    });
    if (!blockCheckpoint) {
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.SYNC_SOURCIFY,
        height: 0,
      });
    }
    this.logger.info('Sync Sourcify from checkpoint:', blockCheckpoint.height);
    const sourcifyMatches = await SourcifyMatch.query()
      .withGraphFetched(
        'verified_contract.[compiled_contract, contract_deployment]'
      )
      .where('id', '>', blockCheckpoint.height)
      .limit(config.jobSyncSourcify.recordsPerCall)
      .orderBy('id', 'asc');
    if (sourcifyMatches.length === 0) {
      return;
    }
    const updatedContractAddresses: string[] = [];
    const evmContractVerifications: EVMContractVerification[] = sourcifyMatches
      .filter(
        (sourcifyMatch) =>
          sourcifyMatch.verified_contract.contract_deployment.chain_id ===
            currentChain.EVMchainId.toString() &&
          (sourcifyMatch.runtime_match === 'perfect' ||
            sourcifyMatch.runtime_match === 'partial')
      )
      .map((sourcifyMatch) => {
        const evmContractVerification = EVMContractVerification.fromJson({
          abi: JSON.stringify(
            sourcifyMatch.verified_contract.compiled_contract
              .compilation_artifacts.abi
          ),
          contract_address: this.toHexString(
            sourcifyMatch.verified_contract.contract_deployment.address
          ),
          creator_tx_hash: this.toHexString(
            sourcifyMatch.verified_contract.contract_deployment.transaction_hash
          ),
          compile_detail: JSON.stringify([{ sourcifySync: 'true' }]),
          compiler_version:
            sourcifyMatch.verified_contract.compiled_contract.version,
          contract_name: sourcifyMatch.verified_contract.compiled_contract.name,
          code_hash: this.toHexString(
            sourcifyMatch.verified_contract.compiled_contract.runtime_code_hash
          ),
          status: EVMContractVerification.VERIFICATION_STATUS.SUCCESS,
        });
        updatedContractAddresses.push(evmContractVerification.contract_address);
        return evmContractVerification;
      });
    await knex.transaction(async (trx) => {
      if (evmContractVerifications.length > 0) {
        await EVMContractVerification.query().insert(evmContractVerifications);
      }
      blockCheckpoint.height = Number(
        sourcifyMatches[sourcifyMatches.length - 1].id
      );
      await BlockCheckpoint.query()
        .insert(blockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id')
        .transacting(trx);
    });

    if (updatedContractAddresses.length > 0) {
      await Promise.all(
        updatedContractAddresses.map((contract) =>
          this.createJob(
            BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
            BULL_JOB_NAME.HANDLE_EVM_SIGNATURE_MAPPING,
            { contract_address: contract },
            {
              removeOnComplete: true,
              removeOnFail: {
                count: 3,
              },
            }
          )
        )
      );
    }
  }

  toHexString(buf: Buffer): string | null {
    if (!buf) {
      return null;
    }
    return `0x${buf.toString('hex')}`;
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.SYNC_SOURCIFY,
      BULL_JOB_NAME.SYNC_SOURCIFY,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobSyncSourcify.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

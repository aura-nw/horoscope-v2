/* eslint-disable no-else-return */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import _ from 'lodash';
import { Context } from 'moleculer';
import { EVMContractVerification, EVMSmartContract } from '../../../models';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import { SERVICE, BULL_JOB_NAME } from '../constant';

@Service({
  name: SERVICE.V1.JobService.InsertVerifyByCodeHash.key,
  version: 1,
})
export default class InsertVerifyByCodeHash extends BullableService {
  @QueueHandler({
    queueName: BULL_JOB_NAME.INSERT_VERIFY_BY_CODEHASH,
    jobName: BULL_JOB_NAME.INSERT_VERIFY_BY_CODEHASH,
  })
  async insertVerifyByCodeHash(_payload: { codehash: string }) {
    const successVerified = await EVMContractVerification.query()
      .where('code_hash', _payload.codehash)
      .andWhere('status', EVMContractVerification.VERIFICATION_STATUS.SUCCESS)
      .orderBy('id', 'desc')
      .limit(1);

    if (successVerified.length === 0) {
      this.logger.info(
        `There is no contract with code_hash ${_payload.codehash} and status ${EVMContractVerification.VERIFICATION_STATUS.SUCCESS}`
      );
      return;
    }

    let done = false;
    let currentId = 0;
    const limitRecordGet = 100;
    const newEvmContractVerification: EVMContractVerification[] = [];
    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      const contracts = await EVMSmartContract.query()
        .withGraphFetched('evm_contract_verifications')
        .modifyGraph('evm_contract_verifications', (builder) => {
          builder
            .select('status')
            .findOne(
              'status',
              EVMContractVerification.VERIFICATION_STATUS.SUCCESS
            )
            .orderBy('id', 'desc');
        })
        .where('code_hash', _payload.codehash)
        .andWhere('id', '>', currentId)
        .limit(limitRecordGet)
        .orderBy('id', 'asc');
      if (contracts.length === 0) {
        done = true;
        break;
      }
      contracts
        .filter((contract) => contract.evm_contract_verifications.length === 0)
        .forEach((contract) => {
          newEvmContractVerification.push(
            EVMContractVerification.fromJson({
              contract_address: contract.address,
              code_hash: contract.code_hash,
              abi: JSON.stringify(successVerified[0].abi),
              compile_detail: JSON.stringify([
                { syncFromId: successVerified[0].id },
              ]),
              compiler_version: successVerified[0].compiler_version,
              contract_name: successVerified[0].contract_name,
              status: EVMContractVerification.VERIFICATION_STATUS.SUCCESS,
            })
          );
        });
      currentId = contracts[contracts.length - 1].id;
    }
    await EVMContractVerification.query().insert(newEvmContractVerification);
    this.logger.info(
      `Inserted EVMContractVerification with codehash ${_payload.codehash}`
    );
  }

  @Action({
    name: SERVICE.V1.JobService.InsertVerifyByCodeHash.action.key,
    params: {
      codehash: {
        type: 'string',
      },
    },
  })
  public actionCreateJob(
    ctx: Context<{ codehash: string }, Record<string, unknown>>
  ) {
    this.createJob(
      BULL_JOB_NAME.INSERT_VERIFY_BY_CODEHASH,
      BULL_JOB_NAME.INSERT_VERIFY_BY_CODEHASH,
      {
        codehash: ctx.params.codehash,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  public async _start(): Promise<void> {
    return super._start();
  }
}

import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Interface, ethers, keccak256, toUtf8Bytes } from 'ethers';
import { ServiceBroker } from 'moleculer';
import { BlockCheckpoint, EVMSmartContract } from 'src/models';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import EtherJsClient from '../../common/utils/etherjs_client';
import { Erc20Contract } from '../../models/erc20_contract';

@Service({
  name: SERVICE.V1.Erc20.key,
  version: 1,
})
export default class Erc20HandlerService extends BullableService {
  etherJsClient!: EtherJsClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
    jobName: BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
  })
  async handleErc20Contract(): Promise<void> {
    await knex.transaction(async (trx) => {
      // get id evm smart contract checkpoint
      const idEvmSmartContractCP =
        (
          await BlockCheckpoint.query().transacting(trx).findOne({
            job_name: BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
          })
        )?.height || 0;
      const erc20SmartContracts = await EVMSmartContract.query()
        .where('id', '>', idEvmSmartContractCP)
        .andWhere('type', 'ERC20')
        .limit(config.erc20.limitEvmSmartContractGet)
        .orderBy('id', 'asc');
      if (erc20SmartContracts.length > 0) {
        const erc20Instances = await this.getErc20Instances(
          erc20SmartContracts
        );
        await Erc20Contract.query().transacting(trx).insert(erc20Instances);
        await BlockCheckpoint.query()
          .transacting(trx)
          .insert({
            job_name: BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
            height: erc20SmartContracts[erc20SmartContracts.length - 1].id,
          })
          .onConflict(['job_name'])
          .merge();
      }
    });
  }

  async getErc20Instances(evmSmartContracts: EVMSmartContract[]) {
    const addresses = evmSmartContracts.map((e) => e.address);
    const names = await this.getBatchInfo(addresses, 'name');
    const totalSupplies = await this.getBatchInfo(addresses, 'totalSupply');
    const decimals = await this.getBatchInfo(addresses, 'decimals');
    const symbols = await this.getBatchInfo(addresses, 'symbols');
    return evmSmartContracts.map((e, index) =>
      Erc20Contract.fromJson({
        evm_smart_contract_id: evmSmartContracts[index],
        total_supply: totalSupplies[index],
        symbol: symbols[index],
        decimals: decimals[index],
        name: names[index],
        track: true,
        last_updated_height: e.created_height,
      })
    );
  }

  async getBatchErc20Info(addresses: string[], funcName: string) {
    const jsonRpcProvider = this.etherJsClient
      .etherJsClient as ethers.JsonRpcProvider;
    const results = await jsonRpcProvider._send(
      addresses.map((addr, index, _) => ({
        id: index,
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            data: keccak256(toUtf8Bytes(`${funcName  }()`)),
            to: addr,
          },
          'latest',
        ],
      }))
    );
    return results.map(
      (result) =>
        new Interface(Erc20Contract.ABI).decodeFunctionResult(
          funcName,
          result.result
        )[0]
    );
  }

  public async _start(): Promise<void> {
    this.etherJsClient = new EtherJsClient(true);
    await this.createJob(
      BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
      BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.erc20.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}

import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Interface, ethers, keccak256, toUtf8Bytes } from 'ethers';
import { ServiceBroker } from 'moleculer';
import { BlockCheckpoint, EVMSmartContract } from 'src/models';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import EtherJsClient from '../../common/utils/etherjs_client';
import { Erc721Contract } from '../../models/erc721_contract';

@Service({
  name: SERVICE.V1.Erc721.key,
  version: 1,
})
export default class Erc721HandlerService extends BullableService {
  etherJsClient!: EtherJsClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
    jobName: BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
  })
  async handleErc721Contract(): Promise<void> {
    await knex.transaction(async (trx) => {
      // get id evm smart contract checkpoint
      // get range blocks for proccessing
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
          [BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM],
          config.erc721.key
        );
      const erc721SmartContracts = await EVMSmartContract.query()
        .where('created_height', '>', startBlock)
        .andWhere('created_height', '<=', endBlock)
        .andWhere('type', 'ERC721')
        .limit(config.erc721.limitEvmSmartContractGet)
        .orderBy('id', 'asc');
      if (erc721SmartContracts.length > 0) {
        const erc721Instances = await this.getErc721Instances(
          erc721SmartContracts
        );
        await Erc721Contract.query().transacting(trx).insert(erc721Instances);
        updateBlockCheckpoint.height =
          erc721SmartContracts[erc721SmartContracts.length - 1].created_height;
        await BlockCheckpoint.query()
          .insert(updateBlockCheckpoint)
          .onConflict('job_name')
          .merge()
          .transacting(trx);
      }
    });
  }

  async getErc721Instances(evmSmartContracts: EVMSmartContract[]) {
    const addresses = evmSmartContracts.map((e) => e.address);
    const names = await this.getBatchErc721Info(addresses, 'name');
    const symbols = await this.getBatchErc721Info(addresses, 'symbol');
    return evmSmartContracts.map((e, index) =>
      Erc721Contract.fromJson({
        evm_smart_contract_id: evmSmartContracts[index],
        symbol: symbols[index],
        name: names[index],
        track: true,
        last_updated_height: e.created_height,
      })
    );
  }

  async getBatchErc721Info(addresses: string[], funcName: string) {
    const jsonRpcProvider = this.etherJsClient
      .etherJsClient as ethers.JsonRpcProvider;
    const results = await jsonRpcProvider._send(
      addresses.map((addr, index, _) => ({
        id: index,
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            data: keccak256(toUtf8Bytes(`${funcName}()`)),
            to: addr,
          },
          'latest',
        ],
      }))
    );
    return results.map(
      (result) =>
        new Interface(Erc721Contract.ABI).decodeFunctionResult(
          funcName,
          result.result
        )[0]
    );
  }

  public async _start(): Promise<void> {
    this.etherJsClient = new EtherJsClient(true);
    await this.createJob(
      BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
      BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.erc721.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}

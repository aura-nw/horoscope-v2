/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import {
  BLOCK_CHECKPOINT_JOB_NAME,
  EVENT_KEY,
  EVENT_TYPE,
  MSG_TYPE,
} from '../../common/constant';
import { ICodeidType, IContractAndInfo } from '../../common/types/interfaces';
import { getLcdClient } from '../../common/utils/aurajs_client';
import BlockCheckpoint from '../../models/block_checkpoint';
import Transaction from '../../models/transaction';

const { CHAIN_ID } = Config;

@Service({
  name: 'asset_tx.handler',
  version: 1,
})
export default class AssetTxHandlerService extends BullableService {
  private _currentAssetHandlerTx = 1;

  private _lcdClient: any;

  private _assetTxBatch: number = Config.ASSET_TX_BATCH
    ? parseInt(Config.ASSET_TX_BATCH, 10)
    : 100;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: 'asset',
    jobType: 'tx_handle',
  })
  private async jobHandler(): Promise<void> {
    this.handleJob(CHAIN_ID);
    // this.handleTxBurnCw721(CHAIN_ID);
  }

  public async _start(): Promise<void> {
    this._lcdClient = await getLcdClient();
    // this.createJob(
    //   'asset',
    //   'tx_handle',
    //   {},
    //   {
    //     removeOnComplete: true,
    //     removeOnFail: {
    //       count: 3,
    //     },
    //   }
    // );
    // this.createJob(
    //   'asset',
    //   'tx_handle',
    //   {},
    //   {
    //     removeOnComplete: true,
    //     removeOnFail: {
    //       count: 3,
    //     },
    //     repeat: {
    //       every: parseInt(Config.ASSET_MILISECOND_REPEAT_JOB, 10),
    //     },
    //   }
    // );
    return super._start();
  }

  private async handleJob(chainId: string) {
    const startTxId: number = this._currentAssetHandlerTx;
    const listTx: Transaction[] = await Transaction.query()
      .where('id', '>=', startTxId)
      .orderBy('id', 'ASC')
      .limit(this._assetTxBatch);
    this.logger.info(
      `startTxId: ${startTxId} to endTxId: ${listTx[listTx.length - 1].id}`
    );
    if (listTx.length > 0) {
      try {
        const listContractsAndInfo = await this.getContractsInputsAndOutputs(
          startTxId,
          listTx[listTx.length - 1].id
        );

        if (listContractsAndInfo.length > 0) {
          await Promise.all(
            listContractsAndInfo.map(async (item: IContractAndInfo) => {
              const { contractAddress } = item;
              const processingFlag = await this.broker.cacher?.get(
                `contract_${chainId}_${contractAddress}`
              );
              if (!processingFlag && contractAddress != null) {
                await this.broker.cacher?.set(
                  `contract_${chainId}_${contractAddress}`,
                  true,
                  Config.CACHER_INDEXER_TTL
                );
                const contractInfo =
                  await this._lcdClient.cosmwasm.wasm.v1.contractInfo({
                    address: contractAddress,
                  });
                const codeidTypes: ICodeidType[] = await import(
                  '../../../codeid_types.json',
                  {
                    assert: { type: 'json' },
                  }
                );
                if (contractInfo != null) {
                  const type = codeidTypes.find(
                    (e) =>
                      e.code_id ===
                      contractInfo.contract_info?.code_id.toString()
                  )?.contract_type;
                  if (type === 'CW20') {
                    console.log('Handle CW20');
                  } else if (type === 'CW721') {
                    // this.broker.call('enrichCw721', {
                    //   address: contractAddress,
                    //   tokemId: tokenId,
                    //   codeId: contractInfo.contract_info?.code_id,
                    //   txData: {
                    //     txhash: item.txhash,
                    //     from: item.from,
                    //     to: item.to,
                    //     amount: item.amount,
                    //     action: item.action,
                    //   },
                    // });
                    console.log(
                      `Handle CW721: ${{
                        address: contractAddress,
                        input: item.input,
                        output: item.output,
                        msg_id: item.msg_id,
                      }}`
                    );
                  } else if (type === 'CW4973') {
                    console.log('Handle CW4973');
                  } else {
                    throw new Error(
                      "Contract address haven't register its type"
                    );
                  }
                }
                // This.logger.debug(`Contract's type does not verify!`, address);
                await this.broker.cacher?.del(
                  `contract_${chainId}_${contractAddress}`
                );
              }
            })
          );
          // Await updateInforPromises;
        }

        // await BlockCheckpoint.query()
        //   .patch({
        //     height: listTx[listTx.length - 1].id + 1,
        //   })
        //   .where('job_name', BLOCK_CHECKPOINT_JOB_NAME.TX_ASSET_HANDLER);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  private async initEnv() {
    // DB -> Config -> MinDB
    // Get handled txs from db
    let TxIdAssetHandler = await BlockCheckpoint.query().findOne({
      job_name: BLOCK_CHECKPOINT_JOB_NAME.TX_ASSET_HANDLER,
    });
    if (!TxIdAssetHandler) {
      // min Tx from DB
      const minTxId = await Transaction.query().orderBy('id', 'ASC').first();
      if (!minTxId) {
        throw Error('Transaction table empty');
      }
      TxIdAssetHandler = await BlockCheckpoint.query().insert({
        job_name: BLOCK_CHECKPOINT_JOB_NAME.TX_ASSET_HANDLER,
        height: Config.ASSET_START_TX_ID
          ? parseInt(Config.ASSET_START_TX_ID, 10)
          : minTxId.id,
      });
    }
    this._currentAssetHandlerTx = TxIdAssetHandler.height;
    this.logger.info(`_currentAssetHandlerTx: ${this._currentAssetHandlerTx}`);
  }

  async getContractsInputsAndOutputs(from: number, to: number) {
    const listContractInputsAndOutputs: IContractAndInfo[] = [];
    // from, from+1, ... to-1
    const listTxs = await Transaction.query()
      .whereBetween('id', [from, to])
      .withGraphFetched(
        '[events(wasmType).attributes(selectKeyValue),messages(filterMsg)]'
      )
      .modifiers({
        wasmType: (builder) => {
          builder.select('type').where('type', EVENT_TYPE.WASM);
        },
        selectKeyValue: (builder) => {
          builder.select('key', 'value');
        },
        filterMsg: (builder) => {
          builder
            .select('content', 'id')
            .whereIn('type', [
              MSG_TYPE.MSG_EXECUTE_CONTRACT,
              MSG_TYPE.MSG_INSTANTIATE_CONTRACT,
            ]); // need check
        },
      });
    listTxs.forEach((tx) => {
      console.log(`Events:\n${JSON.stringify(tx.events)}`);
      console.log(`Messages:\n${JSON.stringify(tx.messages)}`);

      tx.events.forEach(
        (
          event: {
            type: string;
            attributes: [];
          },
          index: number
        ) => {
          let contract: string | null = null;
          event.attributes.forEach(
            (attribute: { key: string; value: string }) => {
              const { key } = attribute;
              if (key === EVENT_KEY.CONTRACT_ADDRESS) {
                contract = attribute.value;
              }
            }
          );
          listContractInputsAndOutputs.push({
            contractAddress: contract,
            input: tx.messages[index],
            output: event.attributes,
            msg_id: tx.messages[index].id,
          });
        }
      );
    });
    return listContractInputsAndOutputs;
  }
}

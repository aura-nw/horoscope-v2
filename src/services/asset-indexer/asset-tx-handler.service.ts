import {
  MsgExecuteContract,
  MsgInstantiateContract,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/tx';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import codeid_types from '../../../codeid_types.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import {
  ATTRIBUTE_KEY,
  BLOCK_CHECKPOINT_JOB_NAME,
  EVENT_TYPE,
  MSG_TYPE,
  SERVICE,
} from '../../common/constant';
import { IContractAndInfo } from '../../common/types/interfaces';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { BlockCheckpoint, Transaction, TransactionMessage } from '../../models';

const { NODE_ENV } = Config;

@Service({
  name: 'asset_tx.handler',
  version: 1,
})
export default class AssetTxHandlerService extends BullableService {
  _currentAssetHandlerTx = 1;

  _lcdClient: any;

  _assetTxBatch: number = Config.ASSET_TX_BATCH
    ? parseInt(Config.ASSET_TX_BATCH, 10)
    : 100;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: 'asset',
    jobType: 'tx_handle',
  })
  async jobHandler(): Promise<void> {
    this.handleJob();
    // this.handleTxBurnCw721(CHAIN_ID);
  }

  async _start(): Promise<void> {
    // await this.waitForServices('v1.CW721');
    this._lcdClient = await getLcdClient();
    if (NODE_ENV !== 'test') {
      await this.initEnv();
      this.createJob(
        'asset',
        'tx_handle',
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: parseInt(Config.ASSET_MILISECOND_REPEAT_JOB, 10),
          },
        }
      );
    }
    return super._start();
  }

  async handleJob() {
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
        const listContractsAndInfo = await this.listContractsAndInfo(
          startTxId,
          listTx[listTx.length - 1].id
        );

        if (listContractsAndInfo.length > 0) {
          await Promise.all(
            listContractsAndInfo.map(async (item: IContractAndInfo) => {
              const { contractAddress } = item;
              if (contractAddress != null) {
                const contractInfo =
                  await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.contractInfo({
                    address: contractAddress,
                  });
                if (contractInfo != null) {
                  const type = codeid_types.find(
                    (e) =>
                      e.code_id.toString() ===
                      contractInfo.contract_info?.code_id
                  )?.contract_type;
                  if (type === 'CW721') {
                    this.broker.call(SERVICE.V1.Cw721.EnrichCw721.path, {
                      address: contractAddress,
                      codeId: contractInfo.contract_info?.code_id,
                      txData: {
                        txhash: item.txhash,
                        sender: item.sender,
                        action: item.action,
                      },
                    });
                    this.logger.debug(`Handle CW721:\n${item}`);
                  } else {
                    throw new Error(
                      `Contract address haven't register its type: ${contractInfo.contract_info?.code_id.toString()}`
                    );
                  }
                }
              }
            })
          );
        }
        await BlockCheckpoint.query()
          .patch({
            height: listTx[listTx.length - 1].id + 1,
          })
          .where('job_name', BLOCK_CHECKPOINT_JOB_NAME.TX_ASSET_HANDLER);
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  async initEnv() {
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

  async listContractsAndInfo(from: number, to: number) {
    const listContractInputsAndOutputs: IContractAndInfo[] = [];
    // from, from+1, ... to-1
    const listTxs = await Transaction.query()
      .alias('tx')
      .whereBetween('tx.id', [from, to])
      .withGraphJoined('messages')
      .whereIn('messages.type', [
        MSG_TYPE.MSG_EXECUTE_CONTRACT,
        MSG_TYPE.MSG_INSTANTIATE_CONTRACT,
      ]);

    // eslint-disable-next-line no-restricted-syntax
    for (const tx of listTxs) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      tx.messages.forEach((message: TransactionMessage, index: number) => {
        if (message.type === MSG_TYPE.MSG_EXECUTE_CONTRACT) {
          const executeMsg: TransactionMessage<MsgExecuteContract> = message;
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const action = Object.keys(JSON.parse(executeMsg.content.msg))[0];
          const { sender } = executeMsg.content;
          const wasmEvent = tx.data.tx_response.logs[index].events.find(
            (event: any) => event.type === EVENT_TYPE.EXECUTE
          );
          wasmEvent.attributes.forEach((attribute: any) => {
            if (attribute.key === ATTRIBUTE_KEY.CONTRACT_ADDRESS) {
              listContractInputsAndOutputs.push({
                contractAddress: attribute.value,
                sender,
                action,
                txhash: tx.hash,
              });
            }
          });
          // listContractInputsAndOutputs.push({
          //   contractAddress: contract,
          //   sender,
          //   action,
          //   txhash: tx.hash,
          // });
        } else if (message.type === MSG_TYPE.MSG_INSTANTIATE_CONTRACT) {
          const instantiateMsg: TransactionMessage<MsgInstantiateContract> =
            message;
          const action = EVENT_TYPE.INSTANTIATE;
          const { sender } = instantiateMsg.content;
          const wasmEvent = tx.data.tx_response.logs[index].events.find(
            (event: any) => event.type === EVENT_TYPE.INSTANTIATE
          );
          wasmEvent.attributes.forEach((attribute: any) => {
            if (attribute.key === ATTRIBUTE_KEY.CONTRACT_ADDRESS) {
              listContractInputsAndOutputs.push({
                contractAddress: attribute.value,
                sender,
                action,
                txhash: tx.hash,
              });
            }
          });
        }
      });
    }
    return listContractInputsAndOutputs;
  }
}

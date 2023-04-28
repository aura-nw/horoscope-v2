import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { Checkpoint, TransactionMessage } from '../../models';
import { BULL_JOB_NAME, MSG_TYPE, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import AuraRegistry from './aura.registry';

@Service({
  name: SERVICE.V1.HandleAuthzTx.key,
})
export default class HandleAuthzTxService extends BullableService {
  private _currentTxMsgId = 0;

  private registry = new AuraRegistry().registry;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  async initEnv() {
    const checkpoint = await Checkpoint.query().findOne({
      job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
    });
    if (!checkpoint) {
      await Checkpoint.query().insert(
        Checkpoint.fromJson({
          job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
          data: {
            transaction_message_id: 0,
          },
        })
      );
    } else if (!checkpoint.data.transaction_message_id) {
      this._currentTxMsgId = checkpoint.data.transaction_message_id;
    } else {
      checkpoint.data.transaction_message_id = 0;
      await Checkpoint.query().update(checkpoint);
    }
  }

  async handleJob() {
    const listTxMsgs = await TransactionMessage.query()
      .orderBy('id', 'asc')
      .where('id', '>', this._currentTxMsgId)
      .andWhere('type', MSG_TYPE.MSG_AUTHZ_EXEC)
      .andWhere('parent_id', null)
      .limit(100);
    const listSubTxAuthz: TransactionMessage[] = [];

    listTxMsgs.forEach(async (txMsg) => {
      txMsg?.content?.msgs.forEach(async (msg: any, index: number) => {
        const decoded = this._camelizeKeys(
          this.registry.decode({
            value: new Uint8Array(Object.values(msg.value)),
            typeUrl: msg.type_url,
          })
        );
        listSubTxAuthz.push(
          TransactionMessage.fromJson({
            tx_id: txMsg.tx_id,
            index,
            type: msg.type_url,
            content: decoded,
            parent_id: txMsg.id,
            sender: txMsg.sender,
          })
        );
      });
    });
    if (listSubTxAuthz.length > 0) {
      await TransactionMessage.query().insert(listSubTxAuthz);
    }
    await Checkpoint.query().update({
      job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
      data: {
        transaction_message_id: listTxMsgs[listTxMsgs.length - 1].id,
      },
    });
  }

  // convert camelcase to underscore
  private _camelizeKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((v: any) => this._camelizeKeys(v));
    }
    if (obj != null && obj.constructor === Object) {
      return Object.keys(obj).reduce(
        (result, key) => ({
          ...result,
          [key === '@type' ? '@type' : _.snakeCase(key)]: this._camelizeKeys(
            obj[key]
          ),
        }),
        {}
      );
    }
    return obj;
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
    jobType: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
    prefix: `horoscope-v2-${config.chainId}`,
  })
  async jobHandler() {
    await this.initEnv();
    await this.handleJob();
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.HANDLE_AUTHZ_TX,
      BULL_JOB_NAME.HANDLE_AUTHZ_TX,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleAuthzTx.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

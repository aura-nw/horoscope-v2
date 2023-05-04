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

  private _checkpoint!: Checkpoint | undefined;

  private _registry!: AuraRegistry;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._registry = new AuraRegistry(this.logger);
  }

  async initEnv() {
    this._checkpoint = await Checkpoint.query().findOne({
      job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
    });
    if (!this._checkpoint) {
      this._checkpoint = Checkpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        data: {
          transaction_message_id: 0,
        },
      });
      await Checkpoint.query().insert(this._checkpoint);
    } else if (this._checkpoint.data.transaction_message_id) {
      this._currentTxMsgId = this._checkpoint.data.transaction_message_id;
    } else {
      this._checkpoint.data.transaction_message_id = 0;
      await Checkpoint.query().update(this._checkpoint);
    }
    this.logger.info(
      'Handle Authz Message from id: ',
      this._checkpoint.data.transaction_message_id
    );
  }

  async handleJob() {
    // query numberOfRow tx message has type authz and has no parent_id
    const listTxMsgs = await TransactionMessage.query()
      .orderBy('id', 'asc')
      .where('id', '>', this._currentTxMsgId)
      .andWhere('type', MSG_TYPE.MSG_AUTHZ_EXEC)
      .andWhere('parent_id', null)
      .limit(config.handleAuthzTx.numberOfRowPerCall);
    const listSubTxAuthz: TransactionMessage[] = [];

    listTxMsgs.forEach(async (txMsg) => {
      this.logger.debug('Handling tx msg id: ', txMsg.id);
      txMsg?.content?.msgs.forEach(async (msg: any, index: number) => {
        const decoded = this._camelizeKeys(
          this._registry.decodeMsg({
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

    if (listTxMsgs.length) {
      if (this._checkpoint) {
        this._checkpoint.data.transaction_message_id =
          listTxMsgs[listTxMsgs.length - 1].id;

        await Checkpoint.query().update(this._checkpoint);
      } else {
        this._checkpoint = Checkpoint.fromJson({
          job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
          data: {
            transaction_message_id: 0,
          },
        });
        await Checkpoint.query().insert(this._checkpoint);
      }
    }
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

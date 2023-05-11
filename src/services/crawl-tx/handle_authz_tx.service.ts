import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { BlockCheckpoint, TransactionMessage } from '../../models';
import { BULL_JOB_NAME, MSG_TYPE, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import AuraRegistry from './aura.registry';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.HandleAuthzTx.key,
  version: 1,
})
export default class HandleAuthzTxService extends BullableService {
  private _blockCheckpoint!: BlockCheckpoint | undefined;

  private _registry!: AuraRegistry;

  private _startBlock = 0;

  private _endBlock = 0;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._registry = new AuraRegistry(this.logger);
  }

  async initEnv() {
    this._blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
    });
    if (!this._blockCheckpoint) {
      this._blockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        height: 0,
      });
      await BlockCheckpoint.query().insert(this._blockCheckpoint);
    } else if (this._blockCheckpoint.height) {
      this._startBlock = this._blockCheckpoint.height;
    } else {
      this._blockCheckpoint.height = 0;
      await BlockCheckpoint.query()
        .update(this._blockCheckpoint)
        .where('job_name', BULL_JOB_NAME.HANDLE_AUTHZ_TX);
    }

    const latestTxHeightCrawled = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.HANDLE_TRANSACTION,
    });

    if (latestTxHeightCrawled) {
      if (
        latestTxHeightCrawled.height >
        this._startBlock + config.handleAuthzTx.blocksPerCall - 1
      ) {
        this._endBlock =
          this._startBlock + config.handleAuthzTx.blocksPerCall - 1;
      } else {
        this._endBlock = latestTxHeightCrawled.height;
      }
    }
  }

  async handleJob() {
    this.logger.info(
      `Handle Authz Message from ${this._startBlock} to ${this._endBlock}`
    );
    // query numberOfRow tx message has type authz and has no parent_id
    const listTxMsgs = await TransactionMessage.query()
      .joinRelated('transaction')
      .where('height', '>=', this._startBlock)
      .andWhere('height', '<=', this._endBlock)
      .andWhere('type', MSG_TYPE.MSG_AUTHZ_EXEC)
      .andWhere('parent_id', null);
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
    await knex.transaction(async (trx) => {
      if (listSubTxAuthz.length > 0) {
        await TransactionMessage.query()
          .insert(listSubTxAuthz)
          .transacting(trx);
      }

      if (this._blockCheckpoint) {
        this._blockCheckpoint.height = this._endBlock;

        await BlockCheckpoint.query()
          .update(this._blockCheckpoint)
          .where('job_name', BULL_JOB_NAME.HANDLE_AUTHZ_TX)
          .transacting(trx);
      } else {
        this._blockCheckpoint = BlockCheckpoint.fromJson({
          job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
          height: 0,
        });
        await BlockCheckpoint.query()
          .insert(this._blockCheckpoint)
          .transacting(trx);
      }
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
    jobName: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
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

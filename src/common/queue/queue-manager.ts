/* eslint-disable max-classes-per-file */

/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { JobsOptions } from 'bullmq';
import { BeeQueueProvider } from './bee-provider';
import { BullJsProvider } from './bulljs-provider';
import { BullQueueProvider } from './bullmq-provider';
import {
  QueueOptions,
  QueueProvider,
  QueueProviderType,
} from './queue-manager-types';

export default class QueueManager {
  private _queueProvider: QueueProvider;

  // prefix?: string = 'bull';
  private _handlerOwner?: any;

  constructor(provider: QueueProvider) {
    // this._name = name;
    this._queueProvider = provider;
  }

  /**
   * factory method to create queue manager
   * @param type - type of provider, default is bullmq
   * @returns
   */
  public static getInstance(type?: QueueProviderType) {
    let provider: QueueProvider;

    switch (type) {
      case QueueProviderType.bullMq:
        provider = new BullQueueProvider();
        break;
      case QueueProviderType.bullJs:
        provider = new BullJsProvider();
        break;
      case QueueProviderType.bee:
        provider = new BeeQueueProvider();
        break;
      default:
        provider = new BullQueueProvider();
    }

    return new QueueManager(provider);
  }

  /**
   * create a bull queue and
   * register a handler for a this one
   */
  public async registerQueueHandler(
    qOpt: QueueOptions,
    fn: (payload: object) => Promise<void>
  ) {
    // bind the owner, so 'this' can be accessed in the handler function
    const f = async (payload: object) => {
      const func = this._handlerOwner ? fn.bind(this._handlerOwner) : fn;
      await func(payload);
    };
    // register the handler
    this._queueProvider.registerQueueHandler(qOpt, f);
  }

  /**
   * bind owner for the queue handler. the bound object will be refered as "this" in the queue handler
   * @param _thisObject -
   */
  public bindQueueOwner(_thisObject: any) {
    this._handlerOwner = _thisObject;
  }

  /**
   * submit a job to a queue
   * @param queueName -
   * @param jobName -
   * @param opts -
   * @param payload - data send to the queue handler
   * @returns
   */
  public async createJob(
    queueName: string,
    jobName?: string,
    opts?: JobsOptions,
    payload?: object
  ): Promise<void> {
    // prepare some input settings if not specified by user
    // jobName = jobName ?? DEFAULT_JOB_NAME;
    // const jobOptions = _.defaults(opts, DEFAULT_JOB_OTION);

    // call to the middleware to submit job
    this._queueProvider.submitJob(queueName, jobName, opts, payload);
  }

  public stopAll(): void {
    this._queueProvider.stopAll();
  }

  public getQueue(queueName: string): any {
    return this._queueProvider.getQueue(queueName);
  }
}

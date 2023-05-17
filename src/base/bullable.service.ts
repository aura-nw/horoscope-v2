/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServiceBroker } from 'moleculer';
import _ from 'underscore';
import QueueManager from '../common/queue/queue-manager';

import { JobOption, QueueOptions } from '../common/queue/queue-manager-types';
import BaseService from './base.service';

// const BULL_REDIS_KEY = process.env.BULL_REDIS_KEY || 'BULL_REDIS_KEY';
export const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX || 'bull';

export default class BullableService extends BaseService {
  private qm?: QueueManager;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this.getQueueManager().bindQueueOwner(this);
  }

  public createJob(
    queueName: string,
    jobType?: string,
    payload?: object,
    opts?: JobOption
  ): Promise<void> {
    return this.getQueueManager().createJob(queueName, jobType, opts, payload);
  }

  public async setHandler(
    opts: QueueOptions,
    fn: (payload: any) => Promise<void>
  ): Promise<void> {
    this.getQueueManager().registerQueueHandler(opts, fn);
  }

  getQueueManager(): QueueManager {
    if (!this.qm) this.qm = QueueManager.getInstance();
    return this.qm;
  }

  // //////////////////////////////////////// life cycle handler

  async stopped() {
    super.stopped();
    try {
      this.getQueueManager().stopAll();
    } catch (e) {
      this.logger.warn('Unable to stop redis queuegracefully.', e);
    }
  }
}

/**
 * Decorator functions to annotate a method as queue handler
 */
export function QueueHandler(opt: Partial<QueueOptions>) {
  return (
    target: any,
    propertyKey: string,
    _descriptor?: PropertyDescriptor
  ) => {
    // it's not a bullable service, do nothing
    if (!target.setHandler) {
      return;
    }

    // default queue name and job type from class and method name
    // const qOpt = { ...defaultOpt, ...opt };
    const qOpt = _.defaults(opt, {
      queueName: target.constructor.name,
      jobType: propertyKey,
      prefix: DEFAULT_PREFIX,
    });

    target.setHandler(qOpt, target[propertyKey]);
  };
}

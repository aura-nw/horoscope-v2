/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServiceBroker } from 'moleculer';
import QueueManager, {
  Job,
  JobOptions,
  QueueOptions,
} from '../common/queue/queue_manager';
import BaseService from './base.service';

const DEFAULT_JOB_OTION: JobOptions = {
  removeOnComplete: true,
  removeOnFail: {
    count: 3,
  },
};

// const BULL_REDIS_KEY = process.env.BULL_REDIS_KEY || 'BULL_REDIS_KEY';
const DEFAULT_REDIS_URL =
  process.env.BULL_REDIS_URL || 'redis://127.0.0.1:6379';

export default class BullableService extends BaseService {
  private qm?: QueueManager;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this.getQueueManager().bindThis(this);
  }

  public createJob(
    queueName: string,
    jobType: string,
    payload?: object,
    opts?: JobOptions
  ): Promise<Job<any>> {
    const jobOptions = { ...DEFAULT_JOB_OTION, ...opts };
    return this.getQueueManager().createJob(
      queueName,
      jobType,
      jobOptions,
      payload
    );
  }

  public async setHandler(
    opts: QueueOptions,
    fn: (payload: any) => Promise<void>
  ): Promise<void> {
    this.getQueueManager().setHandler(opts, fn);
  }

  getQueueManager(): QueueManager {
    if (!this.qm) this.qm = new QueueManager(this.name);
    return this.qm;
  }

  // //////////////////////////////////////// life cycle handler

  async stopped() {
    super.stopped();
    try {
      await this.getQueueManager().stopAll();
    } catch (e) {
      this.logger.warn('Unable to stop database connection gracefully.', e);
    }
  }

  async started() {
    // do some initialization here
    this.getQueueManager().bindThis(this);
  }
}

/**
 * Decorator functions to annotate a method as queue handler
 */
export function QueueHandler(opt?: QueueOptions) {
  return (
    target: any,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ) => {
    if (!target.setHandler) {
      return;
    }

    // default queue name and job type from class and method name
    //
    const defaultOpt: QueueOptions = {
      queueName: target.constructor.name,
      jobType: propertyKey,
      redisUrl: DEFAULT_REDIS_URL,
      reuseRedis: true,
      prefix: 'bull',
    };

    const qOpt = { ...defaultOpt, ...opt };

    target.setHandler(qOpt, target[propertyKey]);
  };
}

/* eslint-disable max-classes-per-file */
import { Job, Queue, Worker, WorkerOptions } from 'bullmq';
import _ from 'underscore';
import { JobOption, QueueOptions, QueueProvider } from './queue-manager-types';
import { getRedisConnection } from './redis-connector';

class DefaultValue {
  static readonly DEFAULT_JOB_NAME = '_default_bull_job';

  static readonly DEFAULT_WORKER_OPTION: WorkerOptions = {
    concurrency: 1,
  };

  static readonly DEFAULT_JOB_OTION: JobOption = {
    // removeOnComplete: true,
    removeOnFail: {
      count: 4,
    },
    removeOnComplete: 3,
  };
}

export class BullQueueProvider implements QueueProvider {
  private _queues = {};

  private _workers: Worker[] = [];

  public submitJob(
    queueName: string,
    jobName: string,
    opts?: JobOption,
    payload?: object
  ): void {
    const q = this.getQueue(queueName);
    q.add(jobName, payload, opts);
  }

  public registerQueueHandler(
    opt: QueueOptions,
    fn: (payload: object) => Promise<void>
  ): void {
    // create a new worker to handle the job
    const processor = async (job: Job) => {
      try {
        await fn(job.data);
      } catch (e) {
        console.error(`job ${job.name} failed`);
        throw e;
      }
    };
    const wo: WorkerOptions = _.defaults(
      opt,
      DefaultValue.DEFAULT_WORKER_OPTION
    );

    console.log(`worker option: ${JSON.stringify(wo)}`);
    wo.connection = getRedisConnection();
    this._workers.push(new Worker(opt.queueName, processor, wo));
  }

  public async stopAll(): Promise<void> {
    await Promise.all(this._workers.map((w) => w.close()));
    this._workers = []; // let the rest to the GC
  }

  /**
   * Create / return a queue with name
   * @param name - Name of the queue
   * @returns
   */
  private getQueue(name: string): Queue {
    if (!this._queues[name]) {
      // queue not exist create and cache it
      this._queues[name] = new Queue(name, {
        connection: getRedisConnection(),
      });
    }

    return this._queues[name];
  }
}
// function getRedisConnection(): import('bullmq').ConnectionOptions {
//   const redisCnn = {
//       host: 'localhost',
//       port: 6379,
//       // port: 6379,
//   };
//   // const redisCnn = {
//   //   path: "127.0.0.1:6379"
//   // };
//   // return redisCnn;
//   let redis = !!path? new IORedis(path): new IORedis();
// }

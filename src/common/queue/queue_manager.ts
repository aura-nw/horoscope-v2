/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Bull from 'bull';
import Redis from 'ioredis';

// If you have the default Redis credentials
// (username, password, host, port)
export { Job, JobOptions } from 'bull';
// export interface JobOptions extends JobOptions { }
export interface QueueOptions {
  queueName?: string;
  jobType?: string;
  redisUrl?: string;
  reuseRedis?: boolean;
  prefix?: string;
}

const REDIS_OPT_FOR_SHARE_CONN = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // enableOfflineQueue: false
};
export default class QueueManager {
  // TODO: add logger
  private _queues = {};

  private _redisConn = new Map<{ url: string; type: string }, Redis>();

  private _name?: string; // for informations

  // static INSTANCE: QueueManager = new QueueManager('singleton');
  prefix?: string = 'bull';

  constructor(name?: string) {
    this._name = name;
  }

  // public static getInstance(): QueueManager {
  //   return QueueManager.INSTANCE;
  // }

  /**
   * setHandler
   */
  public async setHandler(
    qOpt: QueueOptions,
    fn: (payload: object) => Promise<void>
  ) {
    const queue = this.addQueue(qOpt);
    // Create a handler function for the queue
    // console.log("Before queue.process");
    queue.process(qOpt.jobType as string, async (job: any, done: any) => {
      // TODO: Also need to write some preparation here. Let it for now
      const func = this._handlerOwner ? fn.bind(this._handlerOwner) : fn;
      await func(job.data);
      await done();
    });
    // console.log("After queue.process");
  }

  /**
   * Create a Bull Queue object and store it
   */
  public addQueue(qOpt: QueueOptions): Bull.Queue {
    const redisOpt = this.createRedisOpts(qOpt);

    // console.log(`qOpt: ${JSON.stringify(qOpt)}`);
    const queue = new Bull(qOpt.queueName as string, redisOpt);

    // TODO: implements edge case when bull cannot connect to redis. By Default, it will retry forever
    this._queues[qOpt.queueName as string] = queue;

    return queue;
  }

  private _handlerOwner?: any;

  public bindThis(_thisObject: any) {
    this._handlerOwner = _thisObject;
  }
  /*
   * Cache and retrievv redis connection for reuse later
   */

  getRedisConnection = (url: string, type: string): Redis => {
    let cnn = this._redisConn.get({ type, url });
    if (!cnn) {
      cnn = new Redis(url, REDIS_OPT_FOR_SHARE_CONN);
      this._redisConn.set({ type, url }, cnn);
    }
    return cnn;
  };

  /**
   * Create a Redis options object
   * so we can reuse redis connection between queues
   */
  private createRedisOpts(qOpt: QueueOptions): Bull.QueueOptions {
    const redisConnectionFactory = this.getRedisConnection;

    const opts = {
      createClient(type: string): Redis {
        switch (type) {
          case 'client':
          case 'subscriber':
            return qOpt.reuseRedis
              ? redisConnectionFactory(qOpt.redisUrl as string, type)
              : new Redis(qOpt.redisUrl as string);
          default:
            return qOpt.reuseRedis
              ? new Redis(qOpt.redisUrl as string, REDIS_OPT_FOR_SHARE_CONN)
              : new Redis(qOpt.redisUrl as string);
        }
      },
    };

    return opts;
  }

  public getQueue(queueName: string): Bull.Queue {
    return this._queues[queueName];
  }

  public async createJob(
    queueName: string,
    jobName: string,
    opts: Bull.JobOptions,
    payload?: object
  ): Promise<Bull.Job<any>> {
    const queue = this.getQueue(queueName);

    if (!queue) throw new Error(`queue: ${queueName} is not created`);

    return queue.add(jobName, payload, opts);
  }

  public async stopAll() {
    console.log(
      'Trying to stop all queue... This functionality is not implemented fully yet!!!'
    );

    const p = Object.values(this._queues).map(async (q) => {
      const queue = q as Bull.Queue;
      return queue.close();
    });

    await Promise.all(p); // TODO: check why it cannot work
  }
}

// eslint-disable-next-line max-len
// export const QueueHandler = (options: QueueOptions = {}) => function(target: any, key: string, descriptor: PropertyDescriptor) {
//     console.log(`call decorator factory ${JSON.stringify(options)}`);
//     return (target: any, key: string, descriptor: PropertyDescriptor) => {
//         console.log(`call decorator, ${target}, ${key}, ${descriptor} `);
//         // eslint-disable-next-line no-param-reassign
//         descriptor.enumerable = true;
//     };
// };

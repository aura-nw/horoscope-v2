/* eslint-disable @typescript-eslint/no-unused-vars */
import { JobsOptions } from 'bullmq';
import {
  QueueHandlerFunc,
  QueueOptions,
  QueueProvider,
} from './queue-manager-types';

export class BeeQueueProvider implements QueueProvider {
  stopAll(): void {
    throw new Error('Method not implemented.');
  }

  submitJob(
    queueName: string,
    jobName?: string | undefined,
    opts?: JobsOptions | undefined,
    payload?: object | undefined
  ): void {
    throw new Error('Method not implemented.');
  }

  registerQueueHandler(opt: QueueOptions, fn: QueueHandlerFunc): void {
    throw new Error('Method not implemented.');
  }
}

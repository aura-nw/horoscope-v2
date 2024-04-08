/* eslint-disable import/no-import-module-exports */

import { createBullBoard } from '@bull-board/api';
import Queue from 'bull';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as redisuri from 'redisuri';
import { BULL_JOB_NAME, Config } from '../../common';
import { BULL_JOB_NAME as EVM_BULL_JOB_NAME } from '../../services/evm/constant';
import network from '../../../network.json' assert { type: 'json' };
import { DEFAULT_PREFIX } from '../../base/bullable.service';

export const bullBoardMixin = () => ({
  async started() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.logger.info('Generating Bull Board');

    const redisUriComponent = redisuri.parse(Config.QUEUE_JOB_REDIS);
    let rootRedisURI: string;
    if (redisUriComponent.host && redisUriComponent.port) {
      if (redisUriComponent.auth) {
        rootRedisURI = `redis://${redisUriComponent.auth}@${redisUriComponent.host}:${redisUriComponent.port}`;
      } else {
        rootRedisURI = `redis://${redisUriComponent.host}:${redisUriComponent.port}`;
      }
    } else {
      throw Error('BULL REDIS URI is invalid');
    }
    network.forEach((e) => {
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath(`/admin/queues/${e.chainId}`);
      const { setQueues } = createBullBoard({
        queues: [],
        serverAdapter,
      });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.addRoute({
        path: `/admin/queues/${e.chainId}`,
        use: [serverAdapter.getRouter()],
      });

      const listQueues = Object.values({
        ...BULL_JOB_NAME,
        ...EVM_BULL_JOB_NAME,
      }).map(
        (queueName) =>
          new BullAdapter(
            Queue(queueName, `${rootRedisURI}/${e.redisDBNumber}`, {
              prefix: DEFAULT_PREFIX,
            })
          )
      );
      setQueues(listQueues);
    });
  },
});

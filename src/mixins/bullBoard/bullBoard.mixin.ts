/* eslint-disable import/no-import-module-exports */
import { createBullBoard } from '@bull-board/api';
import Queue from 'bull';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BULL_JOB_NAME, Config } from '../../common';
import { DEFAULT_PREFIX } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };

export const bullBoardMixin = () => ({
  async started() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.logger.info('Generating Bull Board');
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(`/admin/queues/${config.chainId}`);
    const { setQueues } = createBullBoard({
      queues: [],
      serverAdapter,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.addRoute({
      path: `/admin/queues/${config.chainId}`,
      use: [serverAdapter.getRouter()],
    });

    const listQueues = Object.values(BULL_JOB_NAME).map(
      (queueName) =>
        new BullAdapter(
          Queue(queueName, Config.QUEUE_JOB_REDIS, {
            prefix: DEFAULT_PREFIX,
          })
        )
    );
    setQueues(listQueues);
  },
});

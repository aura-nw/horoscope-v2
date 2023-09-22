/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Context, ServiceBroker } from 'moleculer';
import { REDIS_KEY, SERVICE } from '../../common';
import BaseService from '../../base/base.service';
import { ErrorCode, ErrorMessage } from '../../common/types/errors';

dayjs.extend(utc);

@Service({
  name: 'api-statistics',
  version: 2,
})
export default class ApiStatisticsService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: 'getDashboardStatistics',
    params: {},
  })
  async getDashboardStatistics() {
    const result = await this.broker.cacher?.get(
      REDIS_KEY.DASHBOARD_STATISTICS
    );
    return result;
  }

  @Action({
    name: 'getTopAccounts',
    params: {},
  })
  async getTopAccounts() {
    const result = await this.broker.cacher?.get(REDIS_KEY.TOP_ACCOUNTS);
    return result;
  }

  @Action({
    name: 'syncPrevDateStats',
    params: {
      startDate: {
        type: 'string',
      },
      endDate: {
        type: 'string',
        optional: true,
      },
    },
  })
  async syncPrevDateStats(
    ctx: Context<
      { startDate: string; endDate: string },
      Record<string, unknown>
    >
  ) {
    // Since each stats job query data of the prev date,
    // so the start and end date needs to change to the following date
    const startTime = dayjs.utc(ctx.params.startDate).add(1, 'day').toDate();
    const endTime = ctx.params.endDate
      ? dayjs.utc(ctx.params.endDate).add(1, 'day').toDate()
      : dayjs.utc(ctx.params.startDate).add(1, 'day').toDate();

    for (
      let date = startTime;
      date <= endTime;
      date.setDate(date.getDate() + 1)
    ) {
      await Promise.all([
        this.broker.call(
          SERVICE.V1.DailyStatisticsService.CreateSpecificDateJob.path,
          { date: date.toString() }
        ),
        this.broker.call(
          SERVICE.V1.AccountStatisticsService.CreateSpecificDateJob.path,
          { date: date.toString() }
        ),
      ]);
    }

    return {
      code: ErrorCode.SUCCESSFUL,
      message: ErrorMessage.SUCCESSFUL,
    };
  }
}

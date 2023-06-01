import { Get, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { REDIS_KEY } from '../../common';
import BaseService from '../../base/base.service';

@Service({
  name: 'dashboard-statistics',
  version: 1,
})
export default class DashboardStatisticsService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Get('/', {
    name: 'getDashboardStatistics',
    params: {},
  })
  async getDashboardStatistics() {
    const result = await this.broker.cacher?.get(
      REDIS_KEY.DASHBOARD_STATISTICS
    );
    return result;
  }
}

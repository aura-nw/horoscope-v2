import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { REDIS_KEY } from '../../common';
import BaseService from '../../base/base.service';

@Service({
  name: 'api-statistics',
  version: 1,
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
}

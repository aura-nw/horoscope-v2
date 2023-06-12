import {
  Action,
  Get,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { REDIS_KEY } from '../../common';
import BaseService from '../../base/base.service';
import networks from '../../../network.json' assert { type: 'json' };

@Service({
  name: 'dashboard-statistics',
  version: 1,
})
export default class DashboardStatisticsService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Get('/', {
    name: 'getDashboardStatisticsByChainId',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
    },
  })
  async getDashboardStatisticsByChainId(
    ctx: Context<{ chainid: string }, Record<string, unknown>>
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );

    return this.broker.call(
      `v1.dashboard-statistics.getDashboardStatistics@${selectedChain?.moleculerNamespace}`
    );
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
}

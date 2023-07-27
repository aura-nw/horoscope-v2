import {
  Get,
  Post,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import BaseService from '../../base/base.service';
import networks from '../../../network.json' assert { type: 'json' };

@Service({
  name: 'statistics',
  version: 2,
})
export default class StatisticsService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Get('/dashboard', {
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
      `v2.api-statistics.getDashboardStatistics@${selectedChain?.moleculerNamespace}`
    );
  }

  @Get('/top-accounts', {
    name: 'getTopAccountsByChainId',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
    },
  })
  async getTopAccountsByChainId(
    ctx: Context<{ chainid: string }, Record<string, unknown>>
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );

    return this.broker.call(
      `v2.api-statistics.getTopAccounts@${selectedChain?.moleculerNamespace}`
    );
  }

  @Post('/sync-prev-date-stats', {
    name: 'syncPrevDateStatsByChainId',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      startDate: {
        type: 'string',
        optional: false,
        default: '2023-01-01',
      },
      endDate: {
        type: 'string',
        optional: true,
        default: '2023-01-02',
      },
    },
  })
  async syncPrevDateStatsByChainId(
    ctx: Context<
      { chainid: string; startDate: string; endDate: string },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );

    return this.broker.call(
      `v2.api-statistics.syncPrevDateStats@${selectedChain?.moleculerNamespace}`,
      {
        startDate: ctx.params.startDate,
        endDate: ctx.params.endDate,
      }
    );
  }
}

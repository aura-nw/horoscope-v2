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
  name: 'statistics',
  version: 1,
})
export default class StatisticsService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
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
      `v1.statistics.getTopAccounts@${selectedChain?.moleculerNamespace}`
    );
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

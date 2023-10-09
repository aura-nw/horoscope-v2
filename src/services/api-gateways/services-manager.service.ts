import { Get, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import networks from '../../../network.json' assert { type: 'json' };
import BaseService from '../../base/base.service';
import { BULL_JOB_NAME } from '../../common';

@Service({
  name: 'services-manager',
  version: 2,
})
export default class ServicesManagerService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Get('/health-check', {
    name: 'healthCheck',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      jobNames: {
        type: 'array',
        optional: false,
        items: 'string',
        enum: Object.values(BULL_JOB_NAME),
      },
    },
  })
  async healthCheck(
    ctx: Context<
      {
        chainid: string;
        jobNames: string[];
      },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    return this.broker.call(
      `v1.ServicesManager.HealthCheck@${selectedChain?.moleculerNamespace}`,
      {
        jobNames: ctx.params.jobNames,
      }
    );
  }
}

import { Get, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import networks from '../../../network.json' assert { type: 'json' };
import BaseService from '../../base/base.service';
import { BULL_JOB_NAME } from '../../common';

@Service({
  name: 'services-manager',
  version: 1,
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
        type: 'multi',
        optional: false,
        rules: [
          {
            type: 'array',
            items: 'string',
            enum: Object.values(BULL_JOB_NAME),
          },
          { type: 'enum', values: Object.values(BULL_JOB_NAME) },
        ],
      },
    },
  })
  async healthCheck(
    ctx: Context<
      {
        chainid: string;
        jobNames: string[] | string;
      },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    const jobNames = Array.isArray(ctx.params.jobNames)
      ? ctx.params.jobNames
      : [ctx.params.jobNames];
    return this.broker.call(
      `v1.ServicesManager.HealthCheck@${selectedChain?.moleculerNamespace}`,
      {
        jobNames,
      }
    );
  }
}

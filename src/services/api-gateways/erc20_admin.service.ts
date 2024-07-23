import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import networks from '../../../network.json' assert { type: 'json' };
import BaseService from '../../base/base.service';

@Service({
  name: 'erc20-admin',
  version: 1,
})
export default class Erc20AdminService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Post('/erc20-reindexing', {
    name: 'erc20Reindexing',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      addresses: {
        type: 'array',
        optional: false,
        items: 'string',
      },
    },
  })
  async erc20Reindexing(
    ctx: Context<
      {
        chainid: string;
        addresses: string[];
      },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    return this.broker.call(
      `v1.Erc20.reindexing@${selectedChain?.moleculerNamespace}`,
      {
        addresses: ctx.params.addresses,
      }
    );
  }
}

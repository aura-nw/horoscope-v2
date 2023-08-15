import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import networks from '../../../network.json' assert { type: 'json' };
import BaseService from '../../base/base.service';

@Service({
  name: 'cw20-admin',
  version: 1,
})
export default class Cw20AdminService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Post('/cw20-reindexing', {
    name: 'cw20Reindexing',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      contractAddress: {
        type: 'string',
        optional: false,
      },
    },
  })
  async cw20ReindexingByChainId(
    ctx: Context<
      { chainid: string; contractAddress: string },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    return this.broker.call(
      `v1.Cw20ReindexingService.reindexing@${selectedChain?.moleculerNamespace}`,
      {
        contractAddress: ctx.params.contractAddress,
      }
    );
  }
}

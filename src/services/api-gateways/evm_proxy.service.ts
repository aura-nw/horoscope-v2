import { Context, ServiceBroker } from 'moleculer';
import { Get, Service } from '@ourparentcenter/moleculer-decorators-extended';
import BaseService from '../../base/base.service';
import networks from '../../../network.json' assert { type: 'json' };
import { SERVICE } from '../evm/constant';

@Service({
  name: 'evm-proxy',
  version: 2,
})
export default class EvmProxy extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Get('/', {
    params: {
      contractAddress: {
        type: 'string',
        trim: true,
        required: true,
        normalize: true,
      },
      chainId: {
        type: 'string',
        trim: true,
        required: true,
        enum: networks.map((network) => network.chainId),
      },
    },
  })
  async getImplementation(
    ctx: Context<{ chainId: string; contractAddress: string }>
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainId
    );

    return this.broker.call(
      `${SERVICE.V2.EvmProxyService.evmProxy.path}@${selectedChain?.moleculerNamespace}`,
      {
        contractAddress: ctx.params.contractAddress,
      }
    );
  }
}

import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { SERVICE } from '../../common';
import BaseService from '../../base/base.service';
import networks from '../../../network.json' assert { type: 'json' };

@Service({
  name: 'horoscope-handler',
  version: 1,
})
export default class HoroscopeHandlerService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Post('/getDataByChainId', {
    name: 'getDataByChainId',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      startBlock: {
        type: 'number',
        optional: false,
      },
      endBlock: {
        type: 'number',
        optional: false,
      },
    },
  })
  async getDataByChainId(
    ctx: Context<
      { chainid: string; startBlock: number; endBlock: number },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    return this.broker.call(
      `${SERVICE.V1.HoroscopeHandlerService.getData.path}@${selectedChain?.moleculerNamespace}`,
      ctx.params
    );
  }
}

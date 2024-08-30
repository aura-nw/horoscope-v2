import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import networks from '../../../network.json' assert { type: 'json' };
import BaseService from '../../base/base.service';
import { REINDEX_TYPE } from '../evm/erc721_reindex';

@Service({
  name: 'erc721-admin',
  version: 1,
})
export default class Erc721AdminService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Post('/erc721-reindexing', {
    name: 'erc721Reindexing',
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
      type: {
        type: 'enum',
        optional: false,
        values: Object.values(REINDEX_TYPE),
      },
    },
  })
  async erc721Reindexing(
    ctx: Context<
      {
        chainid: string;
        addresses: string[];
        type: string;
      },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    return this.broker.call(
      `v1.Erc721.reindexing@${selectedChain?.moleculerNamespace}`,
      {
        addresses: ctx.params.addresses,
        type: ctx.params.type,
      }
    );
  }
}

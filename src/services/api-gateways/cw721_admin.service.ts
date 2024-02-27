import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import networks from '../../../network.json' assert { type: 'json' };
import BaseService from '../../base/base.service';
import { REINDEX_TYPE } from '../cw721/cw721-reindexing.service';
import { SERVICE } from '../../common';

@Service({
  name: 'cw721-admin',
  version: 1,
})
export default class Cw721AdminService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Post('/cw721-reindexing', {
    name: 'cw721Reindexing',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      contractAddresses: {
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
  async cw721Reindexing(
    ctx: Context<
      {
        chainid: string;
        contractAddresses: string[];
        type: string;
      },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    return this.broker.call(
      `v1.Cw721ReindexingService.reindexing@${selectedChain?.moleculerNamespace}`,
      {
        contractAddresses: ctx.params.contractAddresses,
        type: ctx.params.type,
      }
    );
  }

  @Post('/cw721-reindexing-tokens', {
    name: 'cw721ReindexingTokens',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      ids: {
        type: 'array',
        optional: false,
        items: 'number',
      },
    },
  })
  async cw721ReindexingTokens(
    ctx: Context<
      {
        chainid: string;
        ids: number[];
      },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    return this.broker.call(
      `${SERVICE.V1.CW721ReindexingService.ReindexingTokens.path}@${selectedChain?.moleculerNamespace}`,
      {
        ids: ctx.params.ids,
      }
    );
  }
}

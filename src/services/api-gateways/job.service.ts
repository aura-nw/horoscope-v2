import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { SERVICE } from '../../common';
import BaseService from '../../base/base.service';
import networks from '../../../network.json' assert { type: 'json' };

@Service({
  name: 'job',
  version: 1,
})
export default class JobService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Post('/composite-index-to-attribute-partition', {
    name: 'composite-index-to-attribute-partition',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      partitionName: {
        type: 'string',
        optional: false,
      },
      needConcurrently: {
        type: 'boolean',
        optional: false,
        convert: true,
        default: true,
      },
    },
  })
  async createCompositeIndexInAttributePartition(
    ctx: Context<
      { chainid: string; partitionName: string; needConcurrently: boolean },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );

    return this.broker.call(
      `${SERVICE.V1.JobService.CreateIndexCompositeAttrPartition.actionCreateJob.path}@${selectedChain?.moleculerNamespace}`,
      {
        partitionName: ctx.params.partitionName,
        needConcurrently: ctx.params.needConcurrently,
      }
    );
  }

  @Post('/redecode-tx', {
    name: 'redecode-tx',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      type: {
        type: 'string',
        optional: false,
      },
    },
  })
  async reDecodeTx(
    ctx: Context<{ chainid: string; type: string }, Record<string, unknown>>
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );

    return this.broker.call(
      `${SERVICE.V1.JobService.ReDecodeTx.actionCreateJob.path}@${selectedChain?.moleculerNamespace}`,
      {
        type: ctx.params.type,
      }
    );
  }

  @Post('/update-delegator-validator', {
    name: 'update-delegator-validator',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      height: {
        type: 'number',
        optional: false,
      },
    },
  })
  async updateDelegatorValidator(
    ctx: Context<{ chainid: string; height: number }, Record<string, unknown>>
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );
    this.logger.info(
      `${SERVICE.V1.CrawlDelegatorsService.updateAllValidator.path}@${selectedChain?.moleculerNamespace}`
    );
    return this.broker.call(
      `${SERVICE.V1.CrawlDelegatorsService.updateAllValidator.path}@${selectedChain?.moleculerNamespace}`,
      {
        height: ctx.params.height,
      }
    );
  }

  @Post('/signature-mapping', {
    name: 'signature-mapping',
    params: {
      chainid: {
        type: 'string',
        optional: false,
        enum: networks.map((network) => network.chainId),
      },
      addresses: {
        type: 'array',
        optional: false,
      },
    },
  })
  async syncPrevDateStatsByChainId(
    ctx: Context<
      { chainid: string; addresses: string[] },
      Record<string, unknown>
    >
  ) {
    const selectedChain = networks.find(
      (network) => network.chainId === ctx.params.chainid
    );

    await this.broker.call(
      `${SERVICE.V1.SignatureMappingEVM.action.path}@${selectedChain?.moleculerNamespace}`,
      {
        addresses: ctx.params.addresses,
      }
    );
  }
}

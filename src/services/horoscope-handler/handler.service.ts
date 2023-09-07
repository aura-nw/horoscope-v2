import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import _ from 'lodash';
import BaseService from '../../base/base.service';
import { SERVICE } from '../../common';
import { Block, Transaction } from '../../models';
import networks from '../../../network.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.HoroscopeHandlerService.key,
  version: 1,
})
export default class HoroscopeHandlerService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.HoroscopeHandlerService.getData.key,
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
  public async getData(
    ctx: Context<
      { chainid: string; startBlock: number; endBlock: number },
      Record<string, unknown>
    >
  ) {
    // TODO: handler filter from request

    // query to get data
    const { startBlock, endBlock } = ctx.params;
    const queryBlock = Block.query()
      .select('height', 'hash', 'time')
      .withGraphFetched('events.[attributes]')
      .modifyGraph('events', (builder) => {
        builder.select('type', 'source');
      })
      .modifyGraph('events.[attributes]', (builder) => {
        builder.select('key', 'value');
      })
      .where('height', '>=', startBlock)
      .andWhere('height', '<', endBlock)
      .orderBy('height', 'asc');

    const queryTransaction = Transaction.query()
      .select('height', 'hash', 'code', 'codespace', 'memo', 'index')
      .withGraphFetched('messages')
      .withGraphFetched('events.[attributes]')
      .modifyGraph('messages', (builder) => {
        builder
          .select('type', 'sender', 'content', 'index')
          .whereNull('parent_id');
      })
      .modifyGraph('events', (builder) => {
        builder.select('type', 'source');
      })
      .modifyGraph('events.[attributes]', (builder) => {
        builder.select('key', 'value');
      })
      .where('height', '>=', startBlock)
      .andWhere('height', '<', endBlock)
      .orderBy('height', 'asc')
      .orderBy('index', 'asc');
    const [listBlock, listTransaction] = await Promise.all([
      queryBlock,
      queryTransaction,
    ]);

    const resultGroupBy = _.groupBy(
      [...listBlock, ...listTransaction],
      'height'
    );
    const listData: any[] = [];
    Object.keys(resultGroupBy).forEach((height) => {
      if (resultGroupBy[height].length > 0) {
        if (resultGroupBy[height][0] instanceof Block) {
          const data: any = resultGroupBy[height][0];
          if (resultGroupBy[height].length > 1) {
            data.txs = resultGroupBy[height].slice(1);
          }
          listData.push(data);
        } else {
          throw Error('Block not found');
        }
      }
    });
    // handler response
    return listData;
  }
}

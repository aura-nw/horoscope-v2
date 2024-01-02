import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import _ from 'lodash';
import BaseService from '../../base/base.service';
import { SERVICE } from '../../common';
import { Block, Transaction, Event } from '../../models';
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
    // query to get data
    const { startBlock, endBlock } = ctx.params;
    const queryBlock = Block.query()
      .select('height', 'hash', 'time')
      .where('height', '>=', startBlock)
      .andWhere('height', '<', endBlock)
      .orderBy('height', 'asc');

    const queryEventBlock = Event.query()
      .select('type', 'source', 'block_height as height')
      .withGraphFetched('attributes')
      .modifyGraph('attributes', (builder) => {
        builder.select('key', 'value');
      })
      .whereIn('source', [
        Event.SOURCE.BEGIN_BLOCK_EVENT,
        Event.SOURCE.END_BLOCK_EVENT,
      ])
      .andWhere('block_height', '>=', startBlock)
      .andWhere('block_height', '<', endBlock)
      .orderBy('block_height')
      .orderBy('id');

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
        builder.select('type', 'source', 'tx_msg_index');
      })
      .modifyGraph('events.[attributes]', (builder) => {
        builder.select('key', 'value');
      })
      .where('height', '>=', startBlock)
      .andWhere('height', '<', endBlock)
      .orderBy('height', 'asc')
      .orderBy('index', 'asc');
    const [listBlock, listTransaction, listEventBlock] = await Promise.all([
      queryBlock,
      queryTransaction,
      queryEventBlock,
    ]);

    const resultGroupBy = _.groupBy(
      [...listBlock, ...listTransaction, ...listEventBlock],
      'height'
    );
    const listData: any[] = [];
    Object.keys(resultGroupBy).forEach((height) => {
      if (resultGroupBy[height].length > 0) {
        if (resultGroupBy[height][0] instanceof Block) {
          const block: any = resultGroupBy[height].filter(
            (e) => e instanceof Block
          )[0];
          const eventBlocks = resultGroupBy[height].filter(
            (e) => e instanceof Event
          );
          const txs = resultGroupBy[height].filter(
            (e) => e instanceof Transaction
          );
          block.events = eventBlocks.length === 0 ? [] : eventBlocks;
          block.txs = txs.length === 0 ? [] : txs;
          listData.push(block);
        } else {
          throw Error('Block not found');
        }
      }
    });
    // handler response
    return listData;
  }
}

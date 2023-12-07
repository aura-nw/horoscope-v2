import { Transaction, Event, EventAttribute } from '../../models';

export interface IContractMsgInfo {
  contractAddress: string;
  action?: string;
  attributes?: {
    key: string;
    value: string;
  }[];
  tx: Transaction;
  event_id: string;
  index?: number;
}
// from startBlock to endBlock, get all msgs (activities) relating to execute/instantiate contract, each item correspond to an activity
// contractAddress: contract address whom msg intract to
// sender: sender of tx
// action: INSTANTIATE / MINT / TRANSFER_NFT / BURN
// content: input of contract
// attributes: output of an activity in contract (it may have multiple output activities relate to one input)
// tx: tx data
export async function getContractActivities(
  fromBlock: number,
  toBlock: number
) {
  const contractActivities: IContractMsgInfo[] = [];
  const wasmEvents = await Event.query()
    .alias('event')
    .withGraphFetched('[attributes(selectAttribute)]')
    .modifiers({
      selectAttribute(builder) {
        builder.select('event_id', 'index', 'key', 'value').orderBy([
          { column: 'event_id', order: 'asc' },
          { column: 'index', order: 'asc' },
        ]);
      },
      // NOTE: wasm events emitted should mean succeeded transactions
      // filterSuccess(builder) {
      //   builder.where('code', 0);
      // },
    })
    .whereIn('event.type', [
      Event.EVENT_TYPE.WASM,
      Event.EVENT_TYPE.INSTANTIATE,
    ])
    .where('event.block_height', '>', fromBlock)
    .andWhere('event.block_height', '<=', toBlock)
    .orderBy('event.id', 'asc');

  wasmEvents.forEach((wasmEvent, index) => {
    const wasmAttribute: { key: string; value: string }[] =
      wasmEvent.attributes.map((attribute: EventAttribute) => ({
        key: attribute.key,
        value: attribute.value,
      }));
    const action =
      wasmEvent.type === Event.EVENT_TYPE.INSTANTIATE
        ? Event.EVENT_TYPE.INSTANTIATE
        : getAttributeFrom(wasmAttribute, EventAttribute.ATTRIBUTE_KEY.ACTION);
    contractActivities.push({
      contractAddress: getAttributeFrom(
        wasmAttribute,
        EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS
      ),
      action,
      attributes: wasmAttribute,
      tx: wasmEvent.transaction,
      event_id: wasmEvent.id,
      index,
    });
  });
  return contractActivities;
}

// get Attribute value by specified key from array of attributes
export function getAttributeFrom(listAttributes: any, attributeType: string) {
  return listAttributes?.find((attr: any) => attr.key === attributeType)?.value;
}

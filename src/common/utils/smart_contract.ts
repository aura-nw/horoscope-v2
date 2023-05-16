import { Transaction, Event, EventAttribute } from '../../models';

export interface IContractMsgInfo {
  sender: string;
  contractAddress: string;
  action?: string;
  contractType?: string;
  content: string;
  wasm_attributes?: {
    key: string;
    value: string;
  }[];
  tx: Transaction;
  event_id: number;
  index?: number;
}
// from startBlock to endBlock, get all msgs (activities) relating to execute/instantiate contract, each item correspond to an activity
// contractAddress: contract address whom msg intract to
// sender: sender of tx
// action: INSTANTIATE / MINT / TRANSFER_NFT / BURN
// content: input of contract
// wasm_attributes: output of an activity in contract (it may have multiple output activities relate to one input)
// tx: tx data
export async function getContractActivities(
  fromBlock: number,
  toBlock: number
) {
  const contractActivities: IContractMsgInfo[] = [];
  const wasmEvents = await Event.query()
    .alias('event')
    .withGraphJoined(
      '[attributes(selectAttribute), message(selectMessage), transaction(filterSuccess,selectTransaction)]'
    )
    .modifiers({
      selectAttribute(builder) {
        builder.select('id', 'key', 'value');
      },
      selectMessage(builder) {
        builder.select('sender', 'content');
      },
      selectTransaction(builder) {
        builder.select('hash', 'height');
      },
      filterSuccess(builder) {
        builder.where('code', 0);
      },
    })
    .whereIn('event.type', [
      Event.EVENT_TYPE.WASM,
      Event.EVENT_TYPE.INSTANTIATE,
    ])
    .andWhereBetween('event.block_height', [fromBlock, toBlock])
    .orderBy('attributes.id', 'ASC');

  wasmEvents.forEach((wasmEvent) => {
    const wasmActivities: { key: string; value: string }[][] =
      wasmEvent.attributes
        .map((attribute: EventAttribute) => ({
          key: attribute.key,
          value: attribute.value,
        }))
        .reduce(
          (
            acc: { key: string; value: string }[][],
            curr: { key: string; value: string }
          ) => {
            if (curr.key === EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS) {
              acc.push([curr]);
            } else if (acc.length > 0) {
              acc[acc.length - 1].push(curr);
            }
            return acc;
          },
          []
        );
    wasmActivities.forEach((wasmActivity, index) => {
      const action =
        wasmEvent.type === Event.EVENT_TYPE.INSTANTIATE
          ? Event.EVENT_TYPE.INSTANTIATE
          : getAttributeFrom(wasmActivity, EventAttribute.ATTRIBUTE_KEY.ACTION);
      contractActivities.push({
        contractAddress: getAttributeFrom(
          wasmActivity,
          EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS
        ),
        sender: wasmEvent.message.sender,
        action,
        content: wasmEvent.message.content.msg,
        wasm_attributes: wasmActivity,
        tx: wasmEvent.transaction,
        event_id: wasmEvent.id,
        index,
      });
    });
  });
  return contractActivities;
}

// get Attribute value by specified key from array of attributes
export function getAttributeFrom(listAttributes: any, attributeType: string) {
  return listAttributes?.find((attr: any) => attr.key === attributeType)?.value;
}

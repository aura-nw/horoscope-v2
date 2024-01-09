import { Event } from '../../../src/models';

export async function insertFakeEventWithInputId(
  desiredId: number,
  txId: number,
  height: number
): Promise<void> {
  const newEvent = new Event();
  newEvent.id = desiredId.toString();
  newEvent.tx_id = txId;
  newEvent.type = 'transfer';
  newEvent.block_height = height;
  newEvent.source = '1';
  await Event.query().insert(newEvent);
}

export async function getAllEvent(): Promise<Event[]> {
  return Event.query();
}

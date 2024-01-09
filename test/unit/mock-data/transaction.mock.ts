import { Transaction } from '../../../src/models';

export async function insertFakeTxWithInputId(
  desiredId: number,
  height: number
): Promise<void> {
  const newTx = new Transaction();
  newTx.id = desiredId;
  newTx.height = height;
  newTx.hash = new Date().getTime().toString();
  newTx.codespace = 'test';
  newTx.code = 1;
  newTx.gas_used = '1';
  newTx.gas_wanted = '1';
  newTx.gas_limit = '1';
  newTx.fee = '1';
  newTx.timestamp = new Date();
  newTx.data = {};
  await Transaction.query().insert(newTx);
}

import { Block } from '../../../src/models';

export async function insertFakeBlockWithHeight(height: number): Promise<void> {
  const newBlock = new Block();
  newBlock.height = height;
  newBlock.time = new Date();
  newBlock.data = {};
  newBlock.hash = height.toString();
  newBlock.proposer_address = height.toString();
  await Block.query().insert(newBlock);
}

import BaseModel from './BaseModel';

export default class BlockEvent extends BaseModel {
  static get tableName() {
    return 'block_events';
  }
}

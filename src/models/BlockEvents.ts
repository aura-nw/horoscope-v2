import BaseModel from './BaseModel';

export default class BlockEvents extends BaseModel {
  static get tableName() {
    return 'block_events';
  }
}

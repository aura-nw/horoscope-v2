import BaseModel from './BaseModel';

export default class Block extends BaseModel {
  static get tableName() {
    return 'block';
  }
}

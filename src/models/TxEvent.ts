import BaseModel from './BaseModel';

export default class TxEvent extends BaseModel {
  static get tableName() {
    return 'tx_events';
  }
}

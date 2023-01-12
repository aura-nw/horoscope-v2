import BaseModel from './BaseModel';

export default class TxEvents extends BaseModel {
  static get tableName() {
    return 'tx_events';
  }
}

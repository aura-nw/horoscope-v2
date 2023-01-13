import BaseModel from './BaseModel';

export default class EventAttribute extends BaseModel {
  static get tableName() {
    return 'event_attributes';
  }
}

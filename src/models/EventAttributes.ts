import BaseModel from './BaseModel';

export default class EventAttributes extends BaseModel {
  static get tableName() {
    return 'event_attributes';
  }
}

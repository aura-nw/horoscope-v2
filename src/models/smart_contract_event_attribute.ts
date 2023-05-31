/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { SmartContract } from './smart_contract';

export class SmartContractEventAttribute extends BaseModel {
  id!: number;

  smart_contract_event_id!: number;

  key!: string;

  value!: number;

  static get tableName() {
    return 'smart_contract_event_attribute';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['key', 'value'],
      properties: {
        smart_contract_event_id: { type: 'number' },
        key: { type: 'string' },
        value: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      smart_contract_event: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContract,
        join: {
          from: 'smart_contract_event_attribute.smart_contract_event_id',
          to: 'smart_contract_event.id',
        },
      },
    };
  }
}

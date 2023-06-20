import { Model } from 'objection';
import BaseModel from './base';
import CW721Contract from './cw721_contract';

export default class CW721ContractStats extends BaseModel {
  updated_at?: Date;

  static get tableName() {
    return 'cw721_contract_stats';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['cw721_contract_id'],
      properties: {
        cw721_contract_id: { type: 'number' },
        total_activity: { type: 'number' },
        transfer_24h: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      cw721_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Contract,
        join: {
          from: 'cw721_contract_stats.cw721_contract_id',
          to: 'cw721_contract.id',
        },
      },
    };
  }

  $beforeInsert() {
    this.updated_at = new Date();
  }
}

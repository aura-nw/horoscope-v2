import { Model } from 'objection';
import BaseModel from './base';
import { Erc721Contract } from './erc721_contract';

export class Erc721Stats extends BaseModel {
  static softDelete = false;

  updated_at?: Date;

  static get tableName() {
    return 'erc721_stats';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['erc721_contract_id'],
      properties: {
        erc721_contract_id: { type: 'number' },
        total_activity: { type: 'number' },
        transfer_24h: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      erc721_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Erc721Contract,
        join: {
          from: 'erc721_stats.erc721_contract_id',
          to: 'erc721_contract.id',
        },
      },
    };
  }

  $beforeInsert() {
    this.updated_at = new Date();
  }
}

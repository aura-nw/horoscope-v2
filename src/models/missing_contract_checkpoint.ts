import { Model } from 'objection';
import BaseModel from './base';
import { SmartContract } from './smart_contract';

export class MissingContractCheckpoint extends BaseModel {
  [relation: string]: any;

  id!: number;

  smart_contract_id!: number;

  checkpoint!: number;

  end_block!: number;

  create_at!: Date;

  static get tableName() {
    return 'missing_contract_checkpoint';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['checkpoint', 'end_block', 'smart_contract_id'],
      properties: {
        checkpoint: { type: 'number' },
        end_block: { type: 'number' },
        smart_contract_id: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContract,
        join: {
          from: 'missing_contract.smart_contract_id',
          to: 'smart_contract.id',
        },
      },
    };
  }
}

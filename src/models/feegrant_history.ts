import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import Feegrant from './feegrant';
import { Transaction } from './transaction';

export default class FeegrantHistory extends BaseModel {
  [relation: string]: any;

  id!: number;

  tx_id!: number;

  feegrant_id?: number;

  action!: string;

  amount?: string;

  granter!: string;

  grantee!: string;

  denom?: string;

  static get tableName() {
    return 'feegrant_history';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['granter', 'grantee', 'tx_id', 'action'],
      properties: {
        granter: { type: 'string' },
        grantee: { type: 'string' },
        tx_id: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      history: {
        relation: Model.BelongsToOneRelation,
        modelClass: Feegrant,
        join: {
          from: 'feegrant_history.feegrant_id',
          to: 'feegrant.id',
        },
      },
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'feegrant_history.tx_id',
          to: 'transaction.id',
        },
      },
    };
  }
}

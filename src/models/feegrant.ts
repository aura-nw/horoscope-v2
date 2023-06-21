import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { FeegrantHistory } from './feegrant_history';
import { Transaction } from './transaction';

export class Feegrant extends BaseModel {
  [relation: string]: any;

  id!: number;

  init_tx_id?: number;

  revoke_tx_id?: number;

  granter!: string;

  grantee!: string;

  type?: string;

  expiration?: Date;

  status?: string;

  spend_limit?: string;

  denom?: string;

  static get tableName() {
    return 'feegrant';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['granter', 'grantee'],
      properties: {
        granter: { type: 'string' },
        grantee: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      history: {
        relation: Model.HasManyRelation,
        modelClass: FeegrantHistory,
        join: {
          from: 'feegrant.id',
          to: 'feegrant_history.feegrant_id',
        },
      },
      init_transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'feegrant.init_tx_id',
          to: 'transaction.id',
        },
      },
      revoke_transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'feegrant.revoke_tx_id',
          to: 'transaction.id',
        },
      },
    };
  }
}

/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { VerifiedContract } from './verified_contract';

export class SourcifyMatch extends BaseModel {
  [relation: string]: any;

  id!: bigint;

  verified_contract_id!: bigint;

  creation_match!: string;

  runtime_match!: string;

  created_at!: Date;

  static get tableName() {
    return 'sourcify_matches';
  }

  static get relationMappings() {
    return {
      verified_contract: {
        relation: Model.HasOneRelation,
        modelClass: VerifiedContract,
        join: {
          from: 'sourcify_matches.verified_contract_id',
          to: 'verified_contracts.id',
        },
      },
    };
  }
}

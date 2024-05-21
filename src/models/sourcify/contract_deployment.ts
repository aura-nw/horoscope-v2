/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Contract } from './contract';

export class ContractDeployment extends BaseModel {
  id!: string;

  chain_id!: number;

  address!: Buffer;

  transaction_hash!: Buffer;

  block_number!: bigint;

  transaction_index!: bigint;

  deployer!: Buffer;

  contract_id!: string;

  static get tableName() {
    return 'contract_deployments';
  }

  static get relationMappings() {
    return {
      account: {
        relation: Model.BelongsToOneRelation,
        modelClass: Contract,
        join: {
          from: 'contract_deployments.contract_id',
          to: 'contracts.id',
        },
      },
    };
  }
}

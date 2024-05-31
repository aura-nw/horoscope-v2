/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { ContractDeployment } from './contract_deployment';
import { CompiledContract } from './compiled_contract';

export class VerifiedContract extends BaseModel {
  [relation: string]: any;

  id!: bigint;

  created_at!: Date;

  updated_at!: Date;

  created_by!: string;

  updated_by!: Date;

  deployment_id!: string;

  compilation_id!: string;

  creation_match!: boolean;

  creation_values!: any;

  creation_transformations!: any;

  runtime_match!: boolean;

  runtime_values!: any;

  runtime_transformations!: any;

  static get tableName() {
    return 'verified_contracts';
  }

  static get relationMappings() {
    return {
      contract_deployment: {
        relation: Model.BelongsToOneRelation,
        modelClass: ContractDeployment,
        join: {
          from: 'verified_contracts.deployment_id',
          to: 'contract_deployments.id',
        },
      },
      compiled_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: CompiledContract,
        join: {
          from: 'verified_contracts.compilation_id',
          to: 'compiled_contracts.id',
        },
      },
    };
  }
}

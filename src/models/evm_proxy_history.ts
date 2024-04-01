import { Model } from 'objection';
import BaseModel from './base';
import { EVMSmartContract } from './evm_smart_contract';

export class EvmProxyHistory extends BaseModel {
  id!: number;

  proxy_contract!: string;

  implementation_contract!: string;

  admin!: string;

  tx_hash!: string;

  block_height!: number;

  last_updated_height!: number;

  created_at!: Date;

  updated_at!: Date;

  static get tableName() {
    return 'evm_proxy_history';
  }

  static get relationMappings() {
    return {
      evm_smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: EVMSmartContract,
        join: {
          from: 'evm_proxy_history.proxy_contract',
          to: 'evm_smart_contract.address',
        },
      },
    };
  }
}

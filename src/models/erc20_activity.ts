import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Erc20Contract } from './erc20_contract';
import { EvmEvent } from './evm_event';
import { EVMSmartContract } from './evm_smart_contract';

export class Erc20Activity extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  id!: number;

  evm_event_id!: number;

  sender!: string;

  action!: string;

  erc20_contract_address!: string;

  amount!: string;

  from!: string;

  to!: string;

  height!: number;

  tx_hash!: string;

  evm_tx_id!: number;

  static get tableName() {
    return 'erc20_activity';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['evm_event_id', 'erc20_contract_address', 'height'],
      properties: {
        evm_event_id: { type: 'number' },
        erc20_contract_address: { type: 'string' },
        height: { type: 'number' },
        to: { type: 'string' },
        action: { type: 'string' },
        from: { type: 'string' },
        sender: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      erc20_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Erc20Contract,
        join: {
          from: 'erc20_activity.erc20_contract_address',
          to: 'erc20_contract.address',
        },
      },
      evm_smart_contract: {
        relation: Model.HasOneThroughRelation,
        modelClass: EVMSmartContract,
        join: {
          from: 'erc20_activity.erc20_contract_id',
          to: 'smart_contract.id',
          through: {
            from: 'erc20_contract.id',
            to: 'erc20_contract.evm_smart_contract_id',
          },
        },
      },
      evm_event: {
        relation: Model.BelongsToOneRelation,
        modelClass: EvmEvent,
        join: {
          from: 'erc20_activity.evm_event_id',
          to: 'evm_event.id',
        },
      },
    };
  }
}

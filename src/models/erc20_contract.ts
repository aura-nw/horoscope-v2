import { Model } from 'objection';
import BaseModel from './base';
import { EVMSmartContract } from './evm_smart_contract';
// eslint-disable-next-line import/no-cycle
import { Erc20Activity } from './erc20_activity';
import { AccountBalance } from './account_balance';

export class Erc20Contract extends BaseModel {
  [relation: string]: any;

  static softDelete = false;

  id!: number;

  evm_smart_contract_id!: number;

  total_supply!: string;

  symbol?: string;

  address!: string;

  decimal?: string;

  name?: string;

  track!: boolean;

  last_updated_height!: number;

  static get tableName() {
    return 'erc20_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['evm_smart_contract_id'],
      properties: {
        evm_smart_contract_id: { type: 'number' },
        total_supply: { type: 'string' },
        symbol: { type: 'string' },
        decimal: { type: 'string' },
        name: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      evm_smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: EVMSmartContract,
        join: {
          to: 'evm_smart_contract.id',
          from: 'erc20_contract.evm_smart_contract_id',
        },
      },
      activities: {
        relation: Model.HasManyRelation,
        modelClass: Erc20Activity,
        join: {
          to: 'erc20_activity.erc20_contract_address',
          from: 'erc20_contract.address',
        },
      },
      holders: {
        relation: Model.HasManyRelation,
        modelClass: AccountBalance,
        join: {
          to: 'account_balance.denom',
          from: 'erc20_contract.address',
        },
      },
    };
  }

  static ABI = [
    {
      constant: true,
      inputs: [],
      name: 'name',
      outputs: [
        {
          name: '',
          type: 'string',
        },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'totalSupply',
      outputs: [
        {
          name: '',
          type: 'uint256',
        },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [
        {
          name: '',
          type: 'uint8',
        },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'symbol',
      outputs: [
        {
          name: '',
          type: 'string',
        },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
  ];
}

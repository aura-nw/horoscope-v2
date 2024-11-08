/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import { keccak256, toHex } from 'viem';
import BaseModel from './base';
import { EvmProxyHistory } from './evm_proxy_history';

export class EVMSmartContract extends BaseModel {
  [relation: string]: any;

  id!: number;

  created_at!: Date;

  updated_at!: Date;

  address!: string;

  creator!: string;

  created_height!: number;

  created_hash!: string;

  type!: string;

  code_hash!: string;

  status!: string;

  last_updated_tx_id!: number;

  total_tx_to!: number;

  static get tableName() {
    return 'evm_smart_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['address'],
      properties: {
        address: { type: 'string' },
      },
    };
  }

  $beforeInsert() {
    this.created_at = new Date();
    this.updated_at = this.created_at;
  }

  $beforeUpdate() {
    this.updated_at = new Date();
  }

  static get TYPES() {
    return {
      ERC20: 'ERC20',
      ERC721: 'ERC721',
      ERC1155: 'ERC1155',
      PROXY_EIP_1967: 'PROXY_EIP_1967',
      PROXY_EIP_1822: 'PROXY_EIP_1822',
      PROXY_OPEN_ZEPPELIN_IMPLEMENTATION: 'PROXY_OPEN_ZEPPELIN_IMPLEMENTATION',
      PROXY_EIP_1167: 'PROXY_EIP_1167',
      PROXY_EIP_1967_BEACON: 'PROXY_EIP_1967_BEACON',
    };
  }

  static get STATUS() {
    return {
      CREATED: 'CREATED',
      DELETED: 'DELETED',
    };
  }

  static get relationMappings() {
    return {
      evm_proxy_histories: {
        relation: Model.HasManyRelation,
        modelClass: EvmProxyHistory,
        join: {
          from: 'evm_smart_contract.address',
          to: 'evm_proxy_history.proxy_contract',
        },
      },
    };
  }

  static PROXY_EVENT_TOPIC0 = {
    BEACON_UPGRADED: keccak256(toHex('BeaconUpgraded(address)')),
  };

  static BEACON_ABI = [
    {
      inputs: [],
      name: 'implementation',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];
}

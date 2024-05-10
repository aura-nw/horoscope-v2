import { Model } from 'objection';
import BaseModel from './base';
import { EVMSmartContract } from './evm_smart_contract';
// eslint-disable-next-line import/no-cycle
import { Erc721Token } from './erc721_token';
// eslint-disable-next-line import/no-cycle
import { Erc721Activity } from './erc721_activity';

export class Erc721Contract extends BaseModel {
  static softDelete = false;

  id!: number;

  [relation: string]: any;

  evm_smart_contract_id!: number;

  address!: string;

  symbol?: string;

  name?: string;

  track!: boolean;

  last_updated_height!: number;

  static get tableName() {
    return 'erc721_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['evm_smart_contract_id'],
      properties: {
        evm_smart_contract_id: { type: 'number' },
        symbol: { type: 'string' },
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
          from: 'erc721_contract.evm_smart_contract_id',
        },
      },
      tokens: {
        relation: Model.HasManyRelation,
        modelClass: Erc721Token,
        join: {
          from: 'erc721_contract.address',
          to: 'erc721_token.erc721_contract_address',
        },
      },
      erc721_activity: {
        relation: Model.HasManyRelation,
        modelClass: Erc721Activity,
        join: {
          from: 'erc721_contract.address',
          to: 'erc721_activity.erc721_contract_address',
        },
      },
    };
  }

  static ABI = [
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
      inputs: [
        {
          internalType: 'address',
          name: 'owner',
          type: 'address',
        },
      ],
      name: 'balanceOf',
      outputs: [
        {
          internalType: 'uint256',
          name: 'balance',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: 'tokenId',
          type: 'uint256',
        },
      ],
      name: 'getApproved',
      outputs: [
        {
          internalType: 'address',
          name: 'operator',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: 'owner',
          type: 'address',
        },
        {
          internalType: 'address',
          name: 'operator',
          type: 'address',
        },
      ],
      name: 'isApprovedForAll',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'name',
      outputs: [
        {
          internalType: 'string',
          name: '',
          type: 'string',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: 'tokenId',
          type: 'uint256',
        },
      ],
      name: 'ownerOf',
      outputs: [
        {
          internalType: 'address',
          name: 'owner',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'bytes4',
          name: 'interfaceId',
          type: 'bytes4',
        },
      ],
      name: 'supportsInterface',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'symbol',
      outputs: [
        {
          internalType: 'string',
          name: '',
          type: 'string',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: 'tokenId',
          type: 'uint256',
        },
      ],
      name: 'tokenURI',
      outputs: [
        {
          internalType: 'string',
          name: '',
          type: 'string',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];
}

import BaseModel from './base';

export class Erc721HolderStatistic extends BaseModel {
  static softDelete = false;

  erc721_contract_address!: string;

  owner!: string;

  count!: string;

  static get tableName() {
    return 'erc721_holder_statistic';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['erc721_contract_address', 'owner', 'count'],
      properties: {
        erc721_contract_address: { type: 'string' },
        owner: { type: 'string' },
        count: { type: 'string' },
      },
    };
  }
}

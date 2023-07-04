import BaseModel from './base';

export class DailyStatistics extends BaseModel {
  daily_txs!: number;

  daily_active_addresses!: number;

  unique_addresses!: number;

  unique_addresses_increase!: number;

  date!: Date;

  static get tableName() {
    return 'daily_statistics';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'daily_txs',
        'daily_active_addresses',
        'unique_addresses',
        'unique_addresses_increase',
        'date',
      ],
      properties: {
        daily_txs: { type: 'number' },
        daily_active_addresses: { type: 'number' },
        unique_addresses: { type: 'number' },
        unique_addresses_increase: { type: 'number' },
        date: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {};
  }
}

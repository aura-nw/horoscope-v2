import BaseModel from './base';

export class AccountStatistics extends BaseModel {
  address!: string;

  amount_sent!: string;

  amount_received!: string;

  tx_sent!: number;

  gas_used!: string;

  date!: Date;

  static get tableName() {
    return 'account_statistics';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'address',
        'amount_sent',
        'amount_received',
        'tx_sent',
        'gas_used',
        'date',
      ],
      properties: {
        address: { type: 'string' },
        amount_sent: { type: 'string' },
        amount_received: { type: 'string' },
        tx_sent: { type: 'number' },
        gas_used: { type: 'string' },
        date: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {};
  }

  static newAccountStat(address: string, date: string) {
    return AccountStatistics.fromJson({
      address,
      amount_sent: '0',
      amount_received: '0',
      tx_sent: 0,
      gas_used: '0',
      date,
    });
  }
}

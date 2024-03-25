import BaseModel from './base';

export class EvmProxyHistory extends BaseModel {
  id!: number;

  proxy_contract!: string;

  implementation_contract!: string;

  admin!: string;

  tx_hash!: number;

  height_of_change!: number;

  last_updated_height!: number;

  created_at!: Date;

  updated_at!: Date;

  static get tableName() {
    return 'evm_proxy_history';
  }
}

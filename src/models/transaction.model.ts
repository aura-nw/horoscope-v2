import { IEvent, IFee } from 'src/entities/transaction.entity';
import BaseModel from './BaseModel';

export default class Transaction extends BaseModel {
  static get tableName() {
    return 'transaction';
  }

  hash!: string;

  height!: number;

  success!: boolean;

  messages!: object[];

  memo!: string;

  signatures!: string;

  fee!: IFee;

  gas_wanted!: number;

  gas_used!: number;

  raw_log!: IEvent[];

  logs!: IEvent[];

  partition_id!: number;
}

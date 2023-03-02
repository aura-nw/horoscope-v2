import { Model } from 'objection';
import CustomQueryBuilder from './custom_query_builder';
import knex from '../common/utils/db-connection';

export default class BaseModel extends Model {
  static QueryBuilder = CustomQueryBuilder;

  static softDelete = true; // by default, all models are soft deleted

  static delColumn = 'delete_at';

  static get idColumn(): string | string[] {
    return 'id';
  }

  // static customMethod() {
  //   console.log('base customMethod');
  // }

  static isSoftDelete() {
    return this.softDelete;
  }

  QueryBuilderType!: CustomQueryBuilder<this, this[]>;

  // static get QueryBuilder() {
  //   return CustomQueryBuilder;
  // }
  // type QueryBuilderType<T extends { QueryBuilderType: any }> = T['QueryBuilderType'];

  // static query(this: Constructor<M>, trxOrKnex: TransactionOrKnex): QueryBuilderType<M extends Model>{
  //   return super.query(trxOrKnex);
  // }
  // static query<M extends Model>( this: Constructor<M>, trxOrKnex?: TransactionOrKnex): QueryBuilderType<M> {
  //     // @ts-ignore
  //     return super.query(trxOrKnex);
  //   }
}

BaseModel.knex(knex);

/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable max-classes-per-file */
// import {Knex} from 'knex';
import { MaybeCompositeId, Model, Page, QueryBuilder } from 'objection';
import knex from '../common/utils/db_connection';
// import BaseModel from './BaseModel';

//
export default class CustomQueryBuilder<
  M extends Model,
  R = M[]
> extends QueryBuilder<M, R> {
  ArrayQueryBuilderType!: CustomQueryBuilder<M, M[]>;

  SingleQueryBuilderType!: CustomQueryBuilder<M, M>;

  NumberQueryBuilderType!: CustomQueryBuilder<M, number>;

  PageQueryBuilderType!: CustomQueryBuilder<M, Page<M>>;

  delete(forceDelete = false) {
    if (this.isHardDel(forceDelete)) return super.delete();
    return this.softDel();
  }

  deleteById(id: MaybeCompositeId, forceDelete = false) {
    if (this.isHardDel(forceDelete)) return super.deleteById(id);

    return this.softDel().whereRaw(`id = ${id}`);
  }

  whereDeleted() {
    return this.whereNotNull(
      `${this.modelClass().tableName}.${this.getDelColum()}`
    );
  }

  whereNotDeleted() {
    return this.whereNull(
      `${this.modelClass().tableName}.${this.getDelColum()}`
    );
  }

  // Private ultility functions
  private isHardDel(forceFlag: boolean) {
    // TODO: Need to refactor how to access property/method of modelClass
    return forceFlag || !this.modelClass()['softDelete'];
  }

  private getDelColum() {
    return this.modelClass()['delColumn'];
  }

  /**
   * Soft delte a record by update it's 'delete_at' column
   */
  private softDel() {
    const patchData = {};
    patchData[this.getDelColum()] = knex.fn.now();
    return this.patch(patchData);
    // const res = this.patch(patchData);
    // console.log(JSON.stringify(res));
    // return res;
  }
}

// Usage

// class Person extends Model { }
//
// const MixinPerson = CustomQueryBuilderMixin(Person);
//
// // Or as a decorator:
//
// @CustomQueryBuilderMixin
// class Person extends Model { }
//
// async () => {
//   const z = await MixinPerson.query()
//     .whereIn('id', [1, 2])
//     .someCustomMethod()
//     .where('foo', 1)
//     .someCustomMethod();
//
//   z[0].mixinMethod();
// };

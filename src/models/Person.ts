import { ModelObject } from 'objection';
import BaseModel from './BaseModel';

export default class Person extends BaseModel {
  static get tableName() {
    return 'persons';
  }

  // id = 0;

  // static softDelete = false;

  fullName(): string {
    return `${this?.firstName} ${this?.lastName}`;
  }

  firstName?: string;

  lastName?: string;

  // age: number | undefined = 0;
}
export type PersonPoJo = ModelObject<Person>;

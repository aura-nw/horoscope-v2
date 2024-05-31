/* eslint-disable import/no-extraneous-dependencies */
import { Model, AjvValidator } from 'objection';
import addFormats from 'ajv-formats';
import CustomQueryBuilder from '../custom_query_builder';
import knex from '../../common/utils/db_connection_sourcify';

export default class BaseModel extends Model {
  static QueryBuilder = CustomQueryBuilder;

  static createValidator() {
    return new AjvValidator({
      onCreateAjv: (ajv) => {
        addFormats(ajv);
      },
      options: {
        $data: true,
        allErrors: true,
        validateSchema: false,
        ownProperties: true,
        // v5: true,
        coerceTypes: true,
        removeAdditional: true,
      },
    });
  }

  QueryBuilderType!: CustomQueryBuilder<this, this[]>;
}

BaseModel.knex(knex);

import Knex, { Knex as IKnex } from 'knex';
import knexConfig from '../../../knexfile';

const environment = process.env.NODE_ENV || 'development';
const cfg = knexConfig[environment];
const knex = Knex(cfg);

export default knex;

export async function batchUpdate(
  trx: IKnex.Transaction,
  tableName: string,
  records: any,
  fields: string[]
) {
  if (records.length === 0) return;
  const stringListUpdates = records
    .map((record: any) => {
      const values = fields.map((field) => {
        if (record[field]?.type === 'timestamp') {
          if (record[field].value !== undefined) {
            return `to_timestamp(${record[field].value})`;
          }
          return 'NULL::timestamp';
        }
        if (record[field]?.type === 'jsonb') {
          if (record[field].value !== undefined) {
            return `'${record[field].value}'::jsonb`;
          }
          return '{}';
        }
        if (record[field]?.type === 'integer') {
          if (record[field].value !== undefined) {
            return record[field].value;
          }
          return 'NULL::integer';
        }
        if (record[field] !== undefined) {
          return `'${record[field]}'`;
        }
        return 'NULL';
      });
      return `(${record.id}, ${values.join(', ')})`;
    })
    .join(',');
  const query = `
      UPDATE ${tableName}
      SET ${fields.map((field) => `${field} = temp.${field}`).join(', ')}
      FROM (VALUES ${stringListUpdates}) AS temp(id, ${fields.join(', ')})
      WHERE temp.id = ${tableName}.id
    `;
  await trx.raw(query);
}

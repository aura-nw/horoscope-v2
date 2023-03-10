import knex from '../../src/common/utils/db_connection';

export default async function tearDown(
  _globalConfig: any,
  _projectConfig: any
) {
  knex.destroy();
}

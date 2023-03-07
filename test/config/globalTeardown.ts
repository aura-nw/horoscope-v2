import knex from '../../src/common/utils/db-connection';

export default async function tearDown(
  _globalConfig: any,
  _projectConfig: any
) {
  knex.destroy();
}

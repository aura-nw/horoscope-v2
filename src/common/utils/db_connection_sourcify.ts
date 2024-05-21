/* eslint-disable import/export */
import Knex from 'knex';
import knexConfig from '../../../knexfile';

const cfgSourcify = knexConfig.sourcify;
const knexSourcify = Knex(cfgSourcify);
export default knexSourcify;

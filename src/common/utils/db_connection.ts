import Knex from 'knex';
import knexConfig from '../../../knexfile';

const environment = process.env.NODE_ENV || 'development';
const cfg = knexConfig[environment];
const knex = Knex(cfg);

export default knex;

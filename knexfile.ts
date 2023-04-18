import { Knex } from 'knex';
import network from './network.json' assert { type: 'json' };
import configJson from './config.json' assert { type: 'json' };
import { Config } from './src/common';

// Update with your config settings.

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    migrations: {
      directory: './migrations',
    },
    connection: {
      database: network.find((item) => item.chainId === configJson.chainId)
        ?.databaseName,
      host: Config.POSTGRES_HOST,
      user: Config.POSTGRES_USER,
      password: Config.POSTGRES_PASSWORD,
    },
  },
  test: {
    client: 'pg',
    migrations: {
      directory: './migrations',
    },
    connection: {
      database: Config.POSTGRES_DB_TEST,
      host: 'localhost',
      user: Config.POSTGRES_USER,
      password: Config.POSTGRES_PASSWORD,
    },
  },
  production: {
    client: 'mysql',
    connection: {
      database: 'objection',
      user: 'root',
      password: '123456',
    },
  },

  // staging: {
  //   client: 'mysql',
  //   connection: {
  //     database: 'objection',
  //     user: 'root',
  //     password: '123456'
  //   },
  //   pool: {
  //     min: 2,
  //     max: 10
  //   },
  //   migrations: {
  //     tableName: 'knex_migrations'
  //   }
  // },
  //
  // production: {
  //   client: 'postgresql',
  //   connection: {
  //     database: 'my_db',
  //     user: 'username',
  //     password: 'password'
  //   },
  //   pool: {
  //     min: 2,
  //     max: 10
  //   },
  //   migrations: {
  //     tableName: 'knex_migrations'
  //   }
  // }
};

export default config;

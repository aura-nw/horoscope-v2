import { Knex } from 'knex';
import Network from 'src/common/network';
import { Config } from './src/common';

// Update with your config settings.

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    migrations: {
      directory: './migrations',
    },
    connection: {
      database: Network.find((item) => item.chainId === Config.CHAIN_ID)
        ?.databaseName,
      host: 'localhost',
      user: 'phamphong',
      password: 'phamphong9981',
    },
  },
  test: {
    client: 'pg',
    migrations: {
      directory: './migrations',
    },
    connection: {
      database: 'test',
      host: 'localhost',
      user: 'phamphong',
      password: 'phamphong9981',
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

/* eslint-disable capitalized-comments */
import os from 'os';
import { LogLevels } from 'moleculer';
// import dotenvFlow from 'dotenv-flow';
// import _ from 'lodash';
import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { PATH_COSMOS_SDK } from './constant';
// import { DBDialog, DBInfo } from '../types';

// import { PATH_COSMOS_SDK } from './constant';

dotenv.config();

const processEnv = process.env;
// const envVariables = Object.keys(
// dotenvFlow.parse(['./env/.env', './env/.env.development', './env/envIncludes.env']),
// );
const configObj = processEnv;

const isTrue = (text?: string | number) =>
  [1, true, '1', 'true', 'yes'].includes(text || '');

const isFalse = (text?: string | number) =>
  [0, false, '0', 'false', 'no'].includes(text || '');

const getValue = (text?: string, defaultValud?: string | boolean) => {
  const vtrue = isTrue(text);
  const vfalse = isFalse(text);
  const val = text || defaultValud;
  if (vtrue) {
    return true;
  }
  if (vfalse) {
    return false;
  }
  return val;
};

const HOST_NAME = os.hostname().toLowerCase();

// const getDbInfo = (where: string, what: string, defaultValue: string) => {
//     const value = process.env[`DB_${where}_${what}`];
//     const generic = process.env[`DB_GENERIC_${what}`];
//     return value || generic || defaultValue;
// };

// const genericDbInfo = (where: string): DBInfo => ({
//     dialect:
//         process.env.NODE_ENV != 'test'
//             ? (getDbInfo(where, 'DIALECT', 'local') as DBDialog)
//             : (getDbInfo(where, 'TEST_DIALECT', 'local') as DBDialog),
//     user: getDbInfo(where, 'USER', ''),
//     password: getDbInfo(where, 'PASSWORD', ''),
//     host: getDbInfo(where, 'HOST', ''),
//     port: +getDbInfo(where, 'PORT', '0'),
//     dbname:
//         process.env.NODE_ENV != 'test'
//             ? getDbInfo(where, 'DBNAME', '')
//             : getDbInfo(where, 'DBNAME_TEST', ''),
//     collection: getDbInfo(where, 'COLLECTION', where.toLowerCase()),
//     retryWrites: getDbInfo(where, 'RETRY_WRITES', 'false'),
//     replicaSet: getDbInfo(where, 'REPLICA_SET', ''),
//     readPreference: getDbInfo(where, 'READ_PREFERENCE', 'primary'),
//     maxPoolSize: +getDbInfo(where, 'MAX_POOL_SIZE', '10'),
//     uri: getDbInfo(where, 'URI', ''),
// });

export default class ConfigClass {
  public static NODE_ENV: string;

  public static IS_TEST = ConfigClass.NODE_ENV === 'test';

  // public static HOST = process.env.HOST || '0.0.0.0';
  // public static PORT = +(process.env.PORT || 80);
  // public static REQUEST_TIMEOUT = +(process.env.REQUEST_TIMEOUT || 10000);
  // public static NAMESPACE = process.env.NAMESPACE || undefined;
  public static NODEID: string;

  public static TRANSPORTER = process.env.TRANSPORTER || undefined;

  public static CACHER = getValue(process.env.CACHER, undefined);

  public static SERIALIZER = process.env.SERIALIZER || 'JSON'; // "JSON", "Avro", "ProtoBuf", "MsgPack", "Notepack", "Thrift"

  public static MAPPING_POLICY = process.env.MAPPING_POLICY || 'restrict';

  public static LOGLEVEL = (process.env.LOGLEVEL || 'info') as LogLevels;

  public static TRACING_ENABLED = isTrue(process.env.TRACING_ENABLED || '1');

  public static TRACING_TYPE = process.env.TRACING_TYPE || 'Console';

  public static TRACING_ZIPKIN_URL =
    process.env.TRACING_ZIPKIN_URL || 'http://zipkin:9411';

  public static METRICS_ENABLED = isTrue(process.env.METRICS_ENABLED || '1');

  public static METRICS_TYPE = process.env.METRICS_TYPE || 'Prometheus';

  public static METRICS_PORT = +(process.env.METRICS_PORT || 3030);

  public static METRICS_PATH = process.env.METRICS_PATH || '/metrics';

  public static RATE_LIMIT = +(process.env.RATE_LIMIT || 10);

  public static RATE_LIMIT_WINDOW = +(process.env.RATE_LIMIT_WINDOW || 10000);

  public static STRATEGY = process.env.STRATEGY || 'RoundRobin'; // "RoundRobin", "Random", "CpuUsage", "Latency", "Shard"

  // public static JWT_SECRET = process.env.JWT_SECRET || 'dummy-secret';

  public ENABLE_LOADBALANCER = process.env.ENABLE_LOADBALANCER || 'true';

  public GET_LATEST_BLOCK_API =
    process.env.GET_LATEST_BLOCK_API || PATH_COSMOS_SDK.GET_LATEST_BLOCK_API;

  public GET_BLOCK_BY_HEIGHT_API =
    process.env.GET_BLOCK_BY_HEIGHT_API ||
    PATH_COSMOS_SDK.GET_BLOCK_BY_HEIGHT_API;

  public GET_ALL_PROPOSAL =
    process.env.GET_ALL_PROPOSAL || PATH_COSMOS_SDK.GET_ALL_PROPOSAL;

  public GET_PARAMS_BANK =
    process.env.GET_PARAMS_BANK || PATH_COSMOS_SDK.GET_PARAMS_BANK;

  public GET_PARAMS_DISTRIBUTION =
    process.env.GET_PARAMS_DISTRIBUTION ||
    PATH_COSMOS_SDK.GET_PARAMS_DISTRIBUTION;

  public GET_PARAMS_GOV_VOTING =
    process.env.GET_PARAMS_GOV_VOTING || PATH_COSMOS_SDK.GET_PARAMS_GOV_VOTING;

  public GET_PARAMS_GOV_TALLYING =
    process.env.GET_PARAMS_GOV_TALLYING ||
    PATH_COSMOS_SDK.GET_PARAMS_GOV_TALLYING;

  public GET_PARAMS_GOV_DEPOSIT =
    process.env.GET_PARAMS_GOV_DEPOSIT ||
    PATH_COSMOS_SDK.GET_PARAMS_GOV_DEPOSIT;

  public GET_PARAMS_SLASHING =
    process.env.GET_PARAMS_SLASHING || PATH_COSMOS_SDK.GET_PARAMS_SLASHING;

  public GET_PARAMS_STAKING =
    process.env.GET_PARAMS_STAKING || PATH_COSMOS_SDK.GET_PARAMS_STAKING;

  public GET_PARAMS_IBC_TRANSFER =
    process.env.GET_PARAMS_IBC_TRANSFER ||
    PATH_COSMOS_SDK.GET_PARAMS_IBC_TRANSFER;

  public GET_PARAMS_MINT =
    process.env.GET_PARAMS_MINT || PATH_COSMOS_SDK.GET_PARAMS_MINT;

  public GET_TX_API = process.env.GET_TX_API || PATH_COSMOS_SDK.GET_TX_API;

  public GET_ALL_VALIDATOR =
    process.env.GET_ALL_VALIDATOR || PATH_COSMOS_SDK.GET_ALL_VALIDATOR;

  public GET_POOL = process.env.GET_POOL || PATH_COSMOS_SDK.GET_POOL;

  public GET_COMMUNITY_POOL =
    process.env.GET_COMMUNITY_POOL || PATH_COSMOS_SDK.GET_COMMUNITY_POOL;

  public CODE_ID_URI = process.env.CODE_ID_URI || PATH_COSMOS_SDK.CODE_ID_URI;

  public CONTRACT_URI =
    process.env.CONTRACT_URI || PATH_COSMOS_SDK.CONTRACT_URI;

  public GET_SIGNING_INFO =
    process.env.GET_SIGNING_INFO || PATH_COSMOS_SDK.GET_SIGNING_INFO;

  public GET_INFLATION =
    process.env.GET_INFLATION || PATH_COSMOS_SDK.GET_INFLATION;

  public GET_PARAMS_DELEGATE_REWARDS =
    process.env.GET_PARAMS_DELEGATE_REWARDS ||
    PATH_COSMOS_SDK.GET_PARAMS_DELEGATE_REWARDS;

  public GET_TX_API_EVENTS =
    process.env.GET_TX_API_EVENTS || PATH_COSMOS_SDK.GET_TX_API_EVENTS;

  public GET_TX_SEARCH =
    process.env.GET_TX_SEARCH || PATH_COSMOS_SDK.GET_TX_SEARCH;

  public GET_PARAMS_BALANCE =
    process.env.GET_PARAMS_BALANCE || PATH_COSMOS_SDK.GET_PARAMS_BALANCE;

  public GET_PARAMS_DELEGATE =
    process.env.GET_PARAMS_DELEGATE || PATH_COSMOS_SDK.GET_PARAMS_DELEGATE;

  public GET_PARAMS_DELEGATOR =
    process.env.GET_PARAMS_DELEGATOR || PATH_COSMOS_SDK.GET_PARAMS_DELEGATOR;

  public GET_PARAMS_AUTH_INFO =
    process.env.GET_PARAMS_AUTH_INFO || PATH_COSMOS_SDK.GET_PARAMS_AUTH_INFO;

  public GET_PARAMS_SPENDABLE_BALANCE =
    process.env.GET_PARAMS_SPENDABLE_BALANCE ||
    PATH_COSMOS_SDK.GET_PARAMS_SPENDABLE_BALANCE;

  public GET_PARAMS_IBC_DENOM =
    process.env.GET_PARAMS_IBC_DENOM || PATH_COSMOS_SDK.GET_PARAMS_IBC_DENOM;

  public GET_VALIDATOR =
    process.env.GET_VALIDATOR || PATH_COSMOS_SDK.GET_VALIDATOR;

  public GET_DATA_HASH =
    process.env.GET_DATA_HASH || PATH_COSMOS_SDK.GET_DATA_HASH;

  public GET_SUPPLY = process.env.GET_SUPPLY || PATH_COSMOS_SDK.GET_SUPPLY;

  public SEARCH_TX = process.env.SEARCH_TX || PATH_COSMOS_SDK.SEARCH_TX;

  // Dynamic property key
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [index: string]: any;

  public constructor() {
    Object.keys(configObj).forEach((key: string) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this[key] = configObj[key];
    });
    this.NODE_ENV = process.env.NODE_ENV;
    this.NODEID = `${
      process.env.NODEID ? `${process.env.NODEID}-` : ''
    }${HOST_NAME}-${
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.NODE_ENV
    }`;
  }
}

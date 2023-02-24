import { IncomingMessage } from 'http';
import { ActionSchema, ActionParamSchema } from 'moleculer';
import { ActionOptions } from '@ourparentcenter/moleculer-decorators-extended';

// eslint-disable-next-line @typescript-eslint/naming-convention

export type DBDialog = 'local' | 'file' | 'mongodb' | 'mysql';

export interface DBInfo {
  dialect: DBDialog;
  user: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
  collection: string;
  retryWrites: string;
  replicaSet: string;
  readPreference: string;
  maxPoolSize: number;
  uri: string;
}

export interface RouteSchemaOpts {
  path: string;
  whitelist?: string[];
  authorization?: boolean;
  authentication?: boolean;
  aliases?: any;
}

export interface RouteSchema {
  path: string;
  mappingPolicy?: 'restricted' | 'all';
  opts: RouteSchemaOpts;
  middlewares: ((req: any, res: any, next: any) => void)[];
  authorization?: boolean;
  authentication?: boolean;
  logging?: boolean;
  etag?: boolean;
  cors?: any;
  rateLimit?: any;
  whitelist?: string[];
  hasWhitelist: boolean;
  callOptions?: any;
}

export interface RequestMessage extends IncomingMessage {
  $action: ActionSchema;
  $params: ActionParamSchema;
  $route: RouteSchema;
}

export interface RestOptions extends ActionOptions {
  auth?: boolean;
  // Roles?: UserRole | UserRole[];
}

export interface ApiGatewayMeta {
  $statusCode?: number;
  $statusMessage?: string;
  $responseType?: string;
  $responseHeaders?: any;
  $location?: string;
}

export interface INetworkInfo {
  chainName: string;
  chainId: string;
  RPC: string[];
  LCD: string[];
  prefixAddress: string;
  databaseName: string;
}

export interface IVoteAnswer {
  label: string;
  value: string;
}

export interface ISearchTxQuery {
  type: string;
  key: string;
}

export interface IContractAndTokenID {
  contractAddress: string | null;
  tokenId: string | null;
  txhash: string;
}

export interface IContractInfo {
  address: string;
  contract_info: {
    code_id: string;
    creator: string;
    admin: string;
    label: string;
    created: {
      block_height: string;
      tx_index: string;
    };
    ibc_port_id: string;
    extension: {
      '@type': string;
    };
  };
}

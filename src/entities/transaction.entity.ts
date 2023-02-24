/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable max-classes-per-file */
import { ICoin } from './coin.entity';

export interface IPublicKey {
  '@type': string;
  key: string;
}

export interface IMode {
  mode: string;
}
export interface IModeInfo {
  single: IMode;
}
export interface IBody {
  messages: object[];
  memo: string;
  timeout_height: string;
  extension_options: object[];
  non_critical_extension_options: object[];
}
export interface ISignerInfo {
  public_key: IPublicKey;
  mode_info: IModeInfo;
  sequence: string;
}
export interface IFee {
  amount: ICoin[];
  gas_limit: string;
  payer: string;
  granter: string;
}
export interface IAuthInfo {
  signer_infos: ISignerInfo[];
  fee: IFee;
}
export interface ITxInput {
  body: IBody;
  auth_info: IAuthInfo;
  signatures: string[];
}
export interface IAttribute {
  key: string;
  value: string;
  index: boolean;
}
export interface IEvent {
  type: string;
  attributes: IAttribute[];
}
export interface ILog {
  msg_index: number;
  log: string;
  events: IEvent[];
}
export interface ITxResponse {
  height: number;
  txhash: string;
  codespace: string;
  code: string;
  data: string;
  raw_log: string;
  logs: ILog[];
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: object;
  timestamp: Date | null;
  events: IEvent[];
}

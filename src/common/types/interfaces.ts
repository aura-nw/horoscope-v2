export interface INetworkInfo {
  chainName: string;
  chainId: string;
  RPC: string[];
  LCD: string[];
  prefixAddress: string;
  databaseName: string;
}
export interface IContractAndInfo {
  sender: string;
  contractAddress: string;
  action: string;
  tx_hash: string;
}
export interface ICodeidType {
  code_id: number;
  contract_type: string;
}

export interface IAttribute {
  key: string;
  value: string;
}
export interface IEvent {
  type: string;
  attributes: IAttribute[];
}

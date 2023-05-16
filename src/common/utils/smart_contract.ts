// eslint-disable-next-line import/no-extraneous-dependencies
import parse from 'parse-uri';
import axios from 'axios';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { toBase64, toHex, toUtf8 } from '@cosmjs/encoding';
import { cosmwasm } from '@aura-nw/aurajs';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { Transaction, Event, EventAttribute } from '../../models';
import { Config, getHttpBatchClient } from '..';

const IPFS_PREFIX = 'ipfs';
const { IPFS_GATEWAY, REQUEST_IPFS_TIMEOUT } = Config;
const MAX_CONTENT_LENGTH_BYTE = 100000000;
const MAX_BODY_LENGTH_BYTE = 100000000;
export interface IContractMsgInfo {
  sender: string;
  contractAddress: string;
  action?: string;
  contractType?: string;
  content: string;
  wasm_attributes?: {
    key: string;
    value: string;
  }[];
  tx: Transaction;
}

// from startBlock to endBlock, get all msgs (activities) relating to execute/instantiate contract, each item correspond to an activity
// contractAddress: contract address whom msg intract to
// sender: sender of tx
// action: INSTANTIATE / MINT / TRANSFER_NFT / BURN
// content: input of contract
// wasm_attributes: output of an activity in contract (it may have multiple output activities relate to one input)
// tx: tx data
export async function getContractActivities(
  fromBlock: number,
  toBlock: number
) {
  const contractActivities: IContractMsgInfo[] = [];
  const wasmEvents = await Event.query()
    .alias('event')
    .withGraphJoined(
      '[attributes(selectAttribute), message(selectMessage), transaction(filterSuccess,selectTransaction)]'
    )
    .modifiers({
      selectAttribute(builder) {
        builder.select('id', 'key', 'value');
      },
      selectMessage(builder) {
        builder.select('sender', 'content');
      },
      selectTransaction(builder) {
        builder.select('hash', 'height');
      },
      filterSuccess(builder) {
        builder.where('code', 0);
      },
    })
    .whereIn('event.type', [
      Event.EVENT_TYPE.WASM,
      Event.EVENT_TYPE.INSTANTIATE,
    ])
    .andWhereBetween('event.block_height', [fromBlock, toBlock])
    .orderBy('attributes.id', 'ASC');

  wasmEvents.forEach((wasmEvent) => {
    const wasmActivities: { key: string; value: string }[][] =
      wasmEvent.attributes
        .map((attribute: EventAttribute) => ({
          key: attribute.key,
          value: attribute.value,
        }))
        .reduce(
          (
            acc: { key: string; value: string }[][],
            curr: { key: string; value: string }
          ) => {
            if (curr.key === EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS) {
              acc.push([curr]);
            } else if (acc.length > 0) {
              acc[acc.length - 1].push(curr);
            }
            return acc;
          },
          []
        );
    wasmActivities.forEach((wasmActivity) => {
      const action =
        wasmEvent.type === Event.EVENT_TYPE.INSTANTIATE
          ? Event.EVENT_TYPE.INSTANTIATE
          : getAttributeFrom(wasmActivity, EventAttribute.ATTRIBUTE_KEY.ACTION);
      contractActivities.push({
        contractAddress: getAttributeFrom(
          wasmActivity,
          EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS
        ),
        sender: wasmEvent.message.sender,
        action,
        content: wasmEvent.message.content.msg,
        wasm_attributes: wasmActivity,
        tx: wasmEvent.transaction,
      });
    });
  });
  return contractActivities;
}

// get Attribute value by specified key from array of attributes
export function getAttributeFrom(listAttributes: any, attributeType: string) {
  return listAttributes?.find((attr: any) => attr.key === attributeType)?.value;
}

// from IPFS uri, parse to http url
export function parseIPFSUri(uri: string) {
  const parsed = parse(uri);
  let url = '';
  if (parsed.protocol === IPFS_PREFIX) {
    const cid = parsed.host;
    url = `${IPFS_GATEWAY}${cid}`;
    if (parsed.path) {
      url += `${parsed.path}`;
    }
  } else {
    url = uri;
  }
  return url;
}

export async function downloadAttachment(url: string) {
  const axiosClient = axios.create({
    responseType: 'arraybuffer',
    timeout: parseInt(REQUEST_IPFS_TIMEOUT, 10),
    maxContentLength: MAX_CONTENT_LENGTH_BYTE,
    maxBodyLength: MAX_BODY_LENGTH_BYTE,
  });

  return axiosClient.get(url).then((response: any) => {
    const buffer = Buffer.from(response.data, 'base64');
    return buffer;
  });
}

export function parseFilename(media_uri: string) {
  const parsed = parse(media_uri);
  if (parsed.protocol === IPFS_PREFIX) {
    const cid = parsed.host;
    if (parsed.path) {
      return `${cid}${parsed.path}`;
    }
    return cid;
  }
  // eslint-disable-next-line no-useless-escape
  return media_uri.replace(/^.*[\\\/]/, '');
}

export function isValidURI(str: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(str);
  } catch (error) {
    return false;
  }
  return true;
}

// query smart contract state over rpc
export async function querySmartContractState(
  contractAddress: string,
  queryData: string
): Promise<JsonRpcSuccessResponse> {
  const httpBatchClient = getHttpBatchClient();
  return httpBatchClient.execute(
    createJsonRpcRequest('abci_query', {
      path: '/cosmwasm.wasm.v1.Query/SmartContractState',
      data: toHex(
        cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
          address: contractAddress,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          queryData: toBase64(toUtf8(queryData)),
        }).finish()
      ),
    })
  );
}

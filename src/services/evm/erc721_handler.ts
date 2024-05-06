/* eslint-disable no-param-reassign */
/* eslint-disable max-classes-per-file */
import { Dictionary } from 'lodash';
import { decodeAbiParameters, keccak256, toHex } from 'viem';
import Moleculer from 'moleculer';
import parse from 'parse-uri';
import * as isIPFS from 'is-ipfs';
import * as FileType from 'file-type';
import axios, { AxiosError } from 'axios';
import { AWSError } from 'aws-sdk';
import { S3Service } from '../../common/utils/s3';
import { Config } from '../../common';
import { ZERO_ADDRESS } from './constant';
import { Erc721Activity, Erc721Token, EvmEvent } from '../../models';

const s3Client = S3Service.connectS3();
const IPFS_PREFIX = 'ipfs';
const HTTP_PREFIX = 'http';
const HTTPS_PREFIX = 'https';
const {
  BUCKET,
  IPFS_GATEWAY,
  REQUEST_IPFS_TIMEOUT,
  MAX_BODY_LENGTH_BYTE,
  MAX_CONTENT_LENGTH_BYTE,
  S3_GATEWAY,
} = Config;
export const ERC721_EVENT_TOPIC0 = {
  TRANSFER: keccak256(toHex('Transfer(address,address,uint256)')),
  APPROVAL: keccak256(toHex('Approval(address,address,uint256)')),
  APPROVAL_FOR_ALL: keccak256(toHex('ApprovalForAll(address,address,bool)')),
};
export const ABI_TRANSFER_PARAMS = [
  {
    name: 'from',
    type: 'address',
  },
  {
    name: 'to',
    type: 'address',
  },
  {
    name: 'tokenId',
    type: 'uint256',
  },
];
export const ABI_APPROVAL_PARAMS = [
  {
    name: 'owner',
    type: 'address',
  },
  {
    name: 'approved',
    type: 'address',
  },
  {
    name: 'tokenId',
    type: 'uint256',
  },
];
export const ABI_APPROVAL_ALL_PARAMS = [
  {
    name: 'owner',
    type: 'address',
  },
  {
    name: 'approved',
    type: 'address',
  },
];
export const ERC721_ACTION = {
  TRANSFER: 'transfer',
  APPROVAL: 'approval',
  APPROVAL_FOR_ALL: 'approval_for_all',
};
export interface ITokenMediaInfo {
  erc721_token_id: number;
  address: string;
  token_id: string;
  onchain: {
    token_uri?: string;
    metadata: any;
  };
  offchain: {
    image: {
      url?: string;
      content_type?: string;
      file_path?: string;
    };
    animation: {
      url?: string;
      content_type?: string;
      file_path?: string;
    };
  };
}
export class Erc721Handler {
  // key: {contract_address}_{token_id}
  // value: erc721 token
  erc721Tokens: Dictionary<Erc721Token>;

  erc721Activities: Erc721Activity[];

  constructor(
    erc721Tokens: Dictionary<Erc721Token>,
    erc721Activities: Erc721Activity[]
  ) {
    this.erc721Tokens = erc721Tokens;
    this.erc721Activities = erc721Activities;
  }

  process() {
    this.erc721Activities.forEach((erc721Activity) => {
      if (erc721Activity.action === ERC721_ACTION.TRANSFER) {
        this.handlerErc721Transfer(erc721Activity);
      }
    });
  }

  handlerErc721Transfer(erc721Activity: Erc721Activity) {
    const token =
      this.erc721Tokens[
        `${erc721Activity.erc721_contract_address}_${erc721Activity.token_id}`
      ];
    if (token) {
      // update new owner and last updated height
      token.owner = erc721Activity.to;
      token.last_updated_height = erc721Activity.height;
    } else if (erc721Activity.from === ZERO_ADDRESS) {
      // handle mint
      this.erc721Tokens[
        `${erc721Activity.erc721_contract_address}_${erc721Activity.token_id}`
      ] = Erc721Token.fromJson({
        token_id: erc721Activity.token_id,
        owner: erc721Activity.to,
        erc721_contract_address: erc721Activity.erc721_contract_address,
        last_updated_height: erc721Activity.height,
        burned: false,
      });
    } else {
      throw new Error('Handle erc721 tranfer error');
    }
  }

  static buildTransferActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc721Activity | undefined {
    try {
      const [from, to, tokenId] = decodeAbiParameters(
        ABI_TRANSFER_PARAMS,
        (e.topic1 + e.topic2.slice(2) + e.topic3.slice(2)) as `0x${string}`
      ) as [string, string, number];
      return Erc721Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: e.address,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
        token_id: tokenId.toString(),
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static buildApprovalActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc721Activity | undefined {
    try {
      const [from, to, tokenId] = decodeAbiParameters(
        ABI_APPROVAL_PARAMS,
        (e.topic1 + e.topic2.slice(2) + e.topic3.slice(2)) as `0x${string}`
      ) as [string, string, number];
      return Erc721Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC721_ACTION.APPROVAL,
        erc721_contract_address: e.address,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
        token_id: tokenId.toString(),
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static buildApprovalForAllActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc721Activity | undefined {
    try {
      const [from, to] = decodeAbiParameters(
        ABI_APPROVAL_ALL_PARAMS,
        (e.topic1 + e.topic2.slice(2)) as `0x${string}`
      ) as [string, string];
      return Erc721Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC721_ACTION.APPROVAL_FOR_ALL,
        erc721_contract_address: e.address,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }
}

export class Erc721MediaHandler {
  // download image/animation from media_uri, then upload to S3
  async uploadMediaToS3(media_uri?: string) {
    if (media_uri) {
      const fileName = this.parseFilename(media_uri);
      if (!fileName) {
        return null;
      }
      const uploadAttachmentToS3 = async (
        type: string | undefined,
        buffer: Buffer
      ) => {
        const params = {
          Key: fileName,
          Body: buffer,
          Bucket: BUCKET,
          ContentType: type,
        };
        return s3Client
          .upload(params)
          .promise()
          .then(
            (response: { Location: string; Key: string }) => ({
              linkS3: S3_GATEWAY + response.Key,
              contentType: type,
              key: response.Key,
            }),
            (err: string) => {
              throw new Error(err);
            }
          );
      };
      try {
        const s3Object = await s3Client
          .headObject({
            Bucket: BUCKET,
            Key: fileName,
          })
          .promise();
        return {
          linkS3: S3_GATEWAY + fileName,
          contentType: s3Object.ContentType,
          key: fileName,
        };
      } catch (e) {
        const error = e as AWSError;
        if (error.statusCode === 404) {
          const mediaBuffer = await this.downloadAttachment(
            this.parseIPFSUri(media_uri)
          );
          let type: string | undefined = (
            await FileType.fileTypeFromBuffer(mediaBuffer)
          )?.mime;
          if (type === 'application/xml') {
            type = 'image/svg+xml';
          }
          return uploadAttachmentToS3(type, mediaBuffer);
        }
        throw e;
      }
    }
    return null;
  }

  // update s3 media link
  async updateMediaS3(
    tokenMediaInfo: ITokenMediaInfo,
    logger: Moleculer.LoggerInstance
  ) {
    try {
      const mediaImageUrl = await this.uploadMediaToS3(
        tokenMediaInfo.onchain.metadata?.image
      );
      tokenMediaInfo.offchain.image.url = mediaImageUrl?.linkS3;
      tokenMediaInfo.offchain.image.content_type = mediaImageUrl?.contentType;
      tokenMediaInfo.offchain.image.file_path = mediaImageUrl?.key;
    } catch (error) {
      if (error instanceof AxiosError) {
        tokenMediaInfo.offchain.image.url = undefined;
        tokenMediaInfo.offchain.image.content_type = undefined;
        tokenMediaInfo.offchain.image.file_path = undefined;
      } else {
        logger.error(error);
        throw error;
      }
    }
    try {
      const mediaAnimationUrl = await this.uploadMediaToS3(
        tokenMediaInfo.onchain.metadata?.animation_url
      );
      tokenMediaInfo.offchain.animation.url = mediaAnimationUrl?.linkS3;
      tokenMediaInfo.offchain.animation.content_type =
        mediaAnimationUrl?.contentType;
      tokenMediaInfo.offchain.animation.file_path = mediaAnimationUrl?.key;
    } catch (error) {
      if (error instanceof AxiosError) {
        tokenMediaInfo.offchain.animation.url = undefined;
        tokenMediaInfo.offchain.animation.content_type = undefined;
        tokenMediaInfo.offchain.animation.file_path = undefined;
      } else {
        logger.error(error);
        throw error;
      }
    }
    return tokenMediaInfo;
  }

  // from IPFS uri, parse to http url
  parseIPFSUri(uri: string) {
    const formatUri =
      uri.substring(0, 5) === '/ipfs' ? `ipfs:/${uri.slice(5)}` : uri;
    const parsed = parse(formatUri);
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

  // query ipfs get list metadata from token_uris
  async getMetadata(token_uri: string): Promise<{
    image?: string;
    animation_url?: string;
  }> {
    const metadata = await this.downloadAttachment(
      this.parseIPFSUri(token_uri)
    );
    return JSON.parse(metadata.toString());
  }

  // dowload image/animation from url
  async downloadAttachment(url: string) {
    const axiosClient = axios.create({
      responseType: 'arraybuffer',
      timeout: parseInt(REQUEST_IPFS_TIMEOUT, 10),
      maxContentLength: parseInt(MAX_CONTENT_LENGTH_BYTE, 10),
      maxBodyLength: parseInt(MAX_BODY_LENGTH_BYTE, 10),
    });

    return axiosClient.get(url).then((response: any) => {
      const buffer = Buffer.from(response.data, 'base64');
      return buffer;
    });
  }

  // parse filename which be stored in AWS S3
  parseFilename(media_uri: string) {
    const parsed = parse(media_uri);
    if (parsed.protocol === IPFS_PREFIX) {
      const cid = parsed.host;
      if (parsed.path) {
        return `ipfs/${cid}${parsed.path}`;
      }
      return `ipfs/${cid}`; // ipfs://QmPAGifcMvxDBgYr1XmEz9gZiC3DEkfYeinFdVSe364uQp/689.png
    }
    if (parsed.protocol === HTTP_PREFIX || parsed.protocol === HTTPS_PREFIX) {
      if (isIPFS.ipfsUrl(media_uri)) {
        if (isIPFS.ipfsSubdomain(media_uri)) {
          // TODO: parse cid from subdomain
          return parsed.host + parsed.path; // http://bafybeie5gq4jxvzmsym6hjlwxej4rwdoxt7wadqvmmwbqi7r27fclha2va.ipfs.dweb.link/1.jpg
        }
        return parsed.path.substring(1); // http://ipfs.io/ipfs/QmWov9DpE1vYZtTH7JLKXb7b8bJycN91rEPJEmXRXdmh2G/nerd_access_pass.gif
      }
    }
    if (media_uri.startsWith('/ipfs/')) {
      return media_uri.substring(1); // /ipfs/QmPAGifcMvxDBgYr1XmEz9gZiC3DEkfYeinFdVSe364uQp/689.png
    }
    return null;
  }
}

/* eslint-disable no-param-reassign */
import { cosmwasm } from '@aura-nw/aurajs';
import {
  fromBase64,
  fromUtf8,
  toHex,
  toBase64,
  toUtf8,
} from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as FileType from 'file-type';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import parse from 'parse-uri';
import axios from 'axios';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import { S3Service } from '../../common/utils/s3';
import CW721Token from '../../models/cw721_token';

const { NODE_ENV, BUCKET, IPFS_GATEWAY, REQUEST_IPFS_TIMEOUT } = Config;
const IPFS_PREFIX = 'ipfs';
const MAX_CONTENT_LENGTH_BYTE = 100000000;
const MAX_BODY_LENGTH_BYTE = 100000000;
interface ITokenMediaInfo {
  cw721_token_id: number;
  address: string;
  token_id: string;
  onchain: {
    token_uri?: string;
    extension?: any;
    metadata: IMetadata;
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

interface IMetadata {
  image?: string;
  animation_url?: string;
}
const s3Client = new S3Service().connectS3();

@Service({
  name: SERVICE.V1.Cw721.UpdateMedia.key,
  version: 1,
})
export default class Cw721MediaService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
    jobName: BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
  })
  async jobHandlerTokenMedia(_payload: { tokenMedia: ITokenMediaInfo }) {
    let { tokenMedia } = _payload;
    // update metadata
    if (tokenMedia.onchain.token_uri) {
      tokenMedia.onchain.metadata = await this.getMetadata(
        tokenMedia.onchain.token_uri
      );
    } else {
      tokenMedia.onchain.metadata = tokenMedia.onchain.extension;
    }
    // upload & update link s3
    tokenMedia = await this.updateMediaS3(tokenMedia);
    this.logger.debug(tokenMedia);
    await CW721Token.query()
      .where('id', tokenMedia.cw721_token_id)
      .patch({
        media_info: {
          onchain: {
            token_uri: tokenMedia.onchain.token_uri,
            metadata: tokenMedia.onchain.metadata,
          },
          offchain: tokenMedia.offchain,
        },
      });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.FILTER_TOKEN_MEDIA_UNPROCESS,
    jobName: BULL_JOB_NAME.FILTER_TOKEN_MEDIA_UNPROCESS,
  })
  async jobHandlerFilter(): Promise<void> {
    const tokensUnprocess = await CW721Token.query()
      .alias('cw721_token')
      .withGraphJoined('contract.smart_contract')
      .where('media_info', null)
      .andWhere('burned', false)
      .orderBy('id')
      .limit(config.cw721.mediaPerBatch)
      .select(
        'contract:smart_contract.address as contract_address',
        'cw721_token.token_id as token_id',
        'cw721_token.id as cw721_token_id'
      );
    if (tokensUnprocess.length > 0) {
      // get token_uri and extension
      const tokensMediaInfo = await this.getTokensMediaInfo(
        tokensUnprocess.map((token) => ({
          cw721_token_id: token.cw721_token_id,
          contractAddress: token.contract_address,
          onchainTokenId: token.token_id,
        }))
      );
      await Promise.all(
        tokensMediaInfo.map((tokenMedia) =>
          this.createJob(
            BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
            BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
            { tokenMedia },
            {
              removeOnComplete: true,
              removeOnFail: {
                count: 3,
              },
              jobId: `${tokenMedia.address}_${tokenMedia.token_id}`,
            }
          )
        )
      );
    }
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.FILTER_TOKEN_MEDIA_UNPROCESS,
        BULL_JOB_NAME.FILTER_TOKEN_MEDIA_UNPROCESS,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.cw721.millisecondRepeatJobMedia,
          },
        }
      );
    }
    return super._start();
  }

  // get token media info (token_uri, extension) by query rpc
  async getTokensMediaInfo(
    tokens: {
      contractAddress: string;
      onchainTokenId: string;
      cw721_token_id: number;
    }[]
  ): Promise<ITokenMediaInfo[]> {
    const tokensMediaInfo = [];
    const promises: any[] = [];
    tokens.forEach(
      (token: { contractAddress: string; onchainTokenId: string }) => {
        promises.push(
          this.querySmartContractState(
            token.contractAddress,
            `{"all_nft_info":{"token_id": "${token.onchainTokenId}"}}`
          )
        );
      }
    );
    const resultsTokensInfo: JsonRpcSuccessResponse[] = await Promise.all(
      promises
    );
    for (let index = 0; index < resultsTokensInfo.length; index += 1) {
      try {
        const tokenInfo = JSON.parse(
          fromUtf8(
            cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
              fromBase64(resultsTokensInfo[index].result.response.value)
            ).data
          )
        );
        tokensMediaInfo.push({
          address: tokens[index].contractAddress,
          token_id: tokens[index].onchainTokenId,
          cw721_token_id: tokens[index].cw721_token_id,
          onchain: {
            token_uri: tokenInfo.info.token_uri,
            extension: tokenInfo.info.extension,
            metadata: {},
          },
          offchain: {
            image: {
              url: undefined,
              content_type: undefined,
              file_path: undefined,
            },
            animation: {
              url: undefined,
              content_type: undefined,
              file_path: undefined,
            },
          },
        });
      } catch {
        tokensMediaInfo.push({
          address: tokens[index].contractAddress,
          token_id: tokens[index].onchainTokenId,
          cw721_token_id: tokens[index].cw721_token_id,
          onchain: {
            token_uri: undefined,
            extension: undefined,
            metadata: {},
          },
          offchain: {
            image: {
              url: undefined,
              content_type: undefined,
              file_path: undefined,
            },
            animation: {
              url: undefined,
              content_type: undefined,
              file_path: undefined,
            },
          },
        });
      }
    }
    return tokensMediaInfo;
  }

  // query ipfs get list metadata from token_uris
  async getMetadata(token_uri: string): Promise<IMetadata> {
    const metadata = await this.downloadAttachment(
      this.parseIPFSUri(token_uri)
    );
    return JSON.parse(metadata.toString());
  }

  // download image/animation from media_uri, then upload to S3
  async uploadMediaToS3(media_uri?: string) {
    if (media_uri) {
      if (this.isValidURI(media_uri)) {
        const uploadAttachmentToS3 = async (
          type: string | undefined,
          buffer: Buffer
        ) => {
          const params = {
            Key: this.parseFilename(media_uri),
            Body: buffer,
            Bucket: BUCKET,
            ContentType: type,
          };
          return s3Client
            .upload(params)
            .promise()
            .then(
              (response: { Location: string; Key: string }) => ({
                linkS3: response.Location,
                contentType: type,
                key: response.Key,
              }),
              (err: string) => {
                throw new Error(err);
              }
            );
        };
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
    }
    return null;
  }

  // update s3 media link
  async updateMediaS3(tokenMediaInfo: ITokenMediaInfo) {
    const mediaImageUrl = await this.uploadMediaToS3(
      tokenMediaInfo.onchain.metadata.image
    );
    tokenMediaInfo.offchain.image.url = mediaImageUrl?.linkS3;
    tokenMediaInfo.offchain.image.content_type = mediaImageUrl?.contentType;
    tokenMediaInfo.offchain.image.file_path = mediaImageUrl?.key;
    const mediaAnimationUrl = await this.uploadMediaToS3(
      tokenMediaInfo.onchain.metadata.animation_url
    );
    tokenMediaInfo.offchain.animation.url = mediaAnimationUrl?.linkS3;
    tokenMediaInfo.offchain.animation.content_type =
      mediaAnimationUrl?.contentType;
    tokenMediaInfo.offchain.animation.file_path = mediaAnimationUrl?.key;
    return tokenMediaInfo;
  }

  async querySmartContractState(
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

  // from IPFS uri, parse to http url
  parseIPFSUri(uri: string) {
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

  parseFilename(media_uri: string) {
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

  async downloadAttachment(url: string) {
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

  isValidURI(str: string) {
    try {
      // eslint-disable-next-line no-new
      new URL(str);
    } catch (error) {
      return false;
    }
    return true;
  }
}

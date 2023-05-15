/* eslint-disable no-param-reassign */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import {
  fromBase64,
  fromUtf8,
  toHex,
  toUtf8,
  toBase64,
} from '@cosmjs/encoding';
import { cosmwasm } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as FileType from 'file-type';
import CW721Token from '../../models/cw721_token';
import {
  BULL_JOB_NAME,
  Config,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  parseIPFSUri,
  downloadAttachment,
  parseFilename,
} from '../../common/utils/smart_contract';
import { S3Service } from '../../common/utils/s3';
import knex from '../../common/utils/db_connection';

const { NODE_ENV } = Config;

interface ITokenMediaInfo {
  cw721_token_id: number;
  address: string;
  token_id: string;
  onchain: {
    token_uri?: string;
    extension?: any;
    metadata?: any;
  };
  s3: {
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
const s3Client = new S3Service().connectS3();
const BUCKET = config.s3.bucket;

@Service({
  name: SERVICE.V1.Cw721.UpdateMedia.key,
  version: 1,
})
export default class Cw721MediaService extends BullableService {
  _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
    jobType: BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
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
      let tokensMediaInfo = await this.getTokensMediaInfo(
        tokensUnprocess.map((token) => ({
          cw721_token_id: token.cw721_token_id,
          contractAddress: token.contract_address,
          onchainTokenId: token.token_id,
        }))
      );
      tokensMediaInfo = await this.updateMetadata(tokensMediaInfo);
      tokensMediaInfo = await this.updateMediaS3(tokensMediaInfo);
      this.logger.debug(tokensMediaInfo);
      await knex.transaction(async (trx) => {
        const queries: any[] = [];
        tokensMediaInfo.forEach((tokenMediaInfo) => {
          const query = CW721Token.query()
            .where('id', tokenMediaInfo.cw721_token_id)
            .patch({
              media_info: {
                onchain: tokenMediaInfo.onchain,
                s3: tokenMediaInfo.s3,
              },
            })
            .transacting(trx);
          queries.push(query);
        });
        await Promise.all(queries) // Once every query is written
          .then(trx.commit) // Try to execute all of them
          .catch(trx.rollback); // And rollback in case any of them goes wrong
      });
    }
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
        BULL_JOB_NAME.HANDLE_CW721_TOKEN_MEDIA,
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
          this._httpBatchClient.execute(
            createJsonRpcRequest('abci_query', {
              path: '/cosmwasm.wasm.v1.Query/SmartContractState',
              data: toHex(
                cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                  address: token.contractAddress,
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  queryData: toBase64(
                    toUtf8(
                      `{"all_nft_info":{"token_id": "${token.onchainTokenId}"}}`
                    )
                  ),
                }).finish()
              ),
            })
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
          },
          s3: {
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
      } catch (error) {
        tokensMediaInfo.push({
          address: tokens[index].contractAddress,
          token_id: tokens[index].onchainTokenId,
          cw721_token_id: tokens[index].cw721_token_id,
          onchain: {
            token_uri: undefined,
            extension: undefined,
          },
          s3: {
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
  async getlistMetadata(tokenUris: string[]) {
    const listMetadata = await Promise.all(
      tokenUris.map((tokenUri) => downloadAttachment(parseIPFSUri(tokenUri)))
    );
    return listMetadata.map((metadata) => JSON.parse(metadata.toString()));
  }

  // update Metadata
  async updateMetadata(tokensMediaInfo: ITokenMediaInfo[]) {
    const mediasWithUri = tokensMediaInfo.filter(
      (tokenMediaInfo) => tokenMediaInfo.onchain.token_uri
    );
    const listMetadata = await this.getlistMetadata(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      mediasWithUri.map((mediaWithUri) => mediaWithUri.onchain.token_uri)
    );
    mediasWithUri.forEach((mediaWithUri, index) => {
      mediaWithUri.onchain.metadata = listMetadata[index];
    });
    const mediasWithoutUri = tokensMediaInfo.filter(
      (tokenMediaInfo) => !tokenMediaInfo.onchain.token_uri
    );
    mediasWithoutUri.forEach((mediaWithoutUri) => {
      mediaWithoutUri.onchain.metadata = mediaWithoutUri.onchain.extension;
    });
    return [...mediasWithUri, ...mediasWithoutUri];
  }

  // download image/animation from media_uri, then upload to S3
  async uploadMediaToS3(media_uri?: string) {
    if (media_uri) {
      if (this.validURI(media_uri)) {
        const uploadAttachmentToS3 = async (type: any, buffer: any) => {
          const params = {
            Key: parseFilename(media_uri),
            Body: buffer,
            Bucket: BUCKET,
            ContentType: type,
          };
          return s3Client
            .upload(params)
            .promise()
            .then(
              (response: any) => ({
                linkS3: response.Location,
                contentType: type,
                key: response.Key,
              }),
              (err: any) => {
                throw new Error(err);
              }
            );
        };

        return downloadAttachment(parseIPFSUri(media_uri)).then(
          async (buffer) => {
            let type: any = (await FileType.fileTypeFromBuffer(buffer))?.mime;
            if (type === 'application/xml') {
              type = 'image/svg+xml';
            }
            return uploadAttachmentToS3(type, buffer);
          }
        );
      }
    }
    return null;
  }

  // update s3 media link
  async updateMediaS3(tokensMediaInfo: ITokenMediaInfo[]) {
    const listMediaImageUrl = await Promise.all(
      tokensMediaInfo.map((tokenMediaInfo) =>
        this.uploadMediaToS3(tokenMediaInfo.onchain.metadata.image)
      )
    );
    tokensMediaInfo.forEach((tokenMediaInfo, index) => {
      tokenMediaInfo.s3.image.url = listMediaImageUrl[index]?.linkS3;
      tokenMediaInfo.s3.image.content_type =
        listMediaImageUrl[index]?.contentType;
      tokenMediaInfo.s3.image.file_path = listMediaImageUrl[index]?.key;
    });
    const listMediaAnimationUrl = await Promise.all(
      tokensMediaInfo.map((tokenMediaInfo) =>
        this.uploadMediaToS3(tokenMediaInfo.onchain.metadata.animation_url)
      )
    );
    tokensMediaInfo.forEach((tokenMediaInfo, index) => {
      tokenMediaInfo.s3.animation.url = listMediaAnimationUrl[index]?.linkS3;
      tokenMediaInfo.s3.animation.content_type =
        listMediaAnimationUrl[index]?.contentType;
      tokenMediaInfo.s3.animation.file_path = listMediaAnimationUrl[index]?.key;
    });
    return tokensMediaInfo;
  }

  validURI(str: string) {
    try {
      // eslint-disable-next-line no-new
      new URL(str);
    } catch (error) {
      return false;
    }
    return true;
  }
}

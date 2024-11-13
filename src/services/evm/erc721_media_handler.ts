/* eslint-disable no-param-reassign */
import { fromBase64, fromUtf8 } from '@cosmjs/encoding';
import { AWSError } from 'aws-sdk';
import axios, { AxiosError } from 'axios';
import * as FileType from 'file-type';
import * as isIPFS from 'is-ipfs';
import Moleculer from 'moleculer';
import parse from 'parse-uri';
import { Config } from '../../common';
import { S3Service } from '../../common/utils/s3';

const SUPPORT_DECODED_TOKEN_URI = {
  BASE64: 'data:application/json;base64',
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
const axiosClient = axios.create({
  responseType: 'arraybuffer',
  timeout: parseInt(REQUEST_IPFS_TIMEOUT, 10),
  maxContentLength: parseInt(MAX_CONTENT_LENGTH_BYTE, 10),
  maxBodyLength: parseInt(MAX_BODY_LENGTH_BYTE, 10),
});
export class Erc721MediaHandler {
  // download image/animation from media_uri, then upload to S3
  static async uploadMediaToS3(media_uri?: string) {
    if (media_uri) {
      const fileName = Erc721MediaHandler.parseFilenameFromIPFS(media_uri); //
      if (fileName) {
        // case media uri is ipfs supported
        try {
          let s3Object = await s3Client
            .headObject({
              Bucket: BUCKET,
              Key: fileName,
            })
            .promise();
          if (s3Object.ContentType === 'application/octet-stream') {
            s3Object = await s3Client
              .copyObject({
                Bucket: BUCKET,
                CopySource: `${BUCKET}/${fileName}`,
                Key: fileName,
                MetadataDirective: 'REPLACE',
                ContentType: 'image/svg+xml',
              })
              .promise();
          }
          return {
            linkS3: S3_GATEWAY + fileName,
            contentType: s3Object.ContentType,
            key: fileName,
          };
        } catch (e) {
          const error = e as AWSError;
          if (error.statusCode === 404) {
            const mediaBuffer = await Erc721MediaHandler.downloadAttachment(
              Erc721MediaHandler.parseIPFSUri(media_uri)
            );
            let type: string | undefined = (
              await FileType.fileTypeFromBuffer(mediaBuffer)
            )?.mime;
            if (type === 'application/xml') {
              type = 'image/svg+xml';
            }
            return Erc721MediaHandler.uploadAttachmentToS3(
              fileName,
              type,
              mediaBuffer
            );
          }
          throw e;
        }
      } else {
        // case media uri is http/https uri: just support image, video, audio, model
        const type = await this.getContentType(media_uri);
        const isContentTypeSupported =
          type.startsWith('image') ||
          type.startsWith('video') ||
          type.startsWith('audio') ||
          type.startsWith('model');
        return isContentTypeSupported
          ? {
              linkS3: media_uri,
              contentType: type,
              key: undefined,
            }
          : null;
      }
    }
    return null;
  }

  static async uploadAttachmentToS3(
    file: string,
    type: string | undefined,
    buffer: Buffer
  ) {
    const params = {
      Key: file,
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
  }

  // update s3 media link
  static async updateMediaS3(
    tokenMediaInfo: ITokenMediaInfo,
    logger: Moleculer.LoggerInstance
  ) {
    try {
      const mediaImageUrl = await Erc721MediaHandler.uploadMediaToS3(
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
      const mediaAnimationUrl = await Erc721MediaHandler.uploadMediaToS3(
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
  static parseIPFSUri(uri: string) {
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
  static async getMetadata(token_uri: string): Promise<{
    image?: string;
    animation_url?: string;
  }> {
    let metadata = token_uri;
    try {
      if (token_uri.startsWith(`${SUPPORT_DECODED_TOKEN_URI.BASE64},`)) {
        const base64Metadata = token_uri.split(',')[1];
        metadata = fromUtf8(fromBase64(base64Metadata));
      }
    } catch {
      // not base64
    }
    try {
      metadata = (
        await Erc721MediaHandler.downloadAttachment(
          Erc721MediaHandler.parseIPFSUri(token_uri)
        )
      ).toString();
    } catch {
      // ipfs/https/http url couldn't loaded
    }
    // check json
    return JSON.parse(metadata);
  }

  // dowload image/animation from http/https url
  static async downloadAttachment(url: string) {
    const fromGithub = url.startsWith('https://github.com');
    const formatedUrl = fromGithub ? `${url}?raw=true` : url;
    return axiosClient.get(formatedUrl).then((response: any) => {
      const buffer = Buffer.from(response.data, 'base64');
      return buffer;
    });
  }

  // head request to get ContentType
  static async getContentType(url: string): Promise<string> {
    const fromGithub = url.startsWith('https://github.com');
    const formatedUrl = fromGithub ? `${url}?raw=true` : url;
    return axiosClient
      .head(formatedUrl)
      .then((response) => response.headers['content-type']);
  }

  /**
   * @description check is ipfs format supported.
   * If true, from media uri => check and parse that uri to unique filename (base on ipfs) that saved on AWS
   * If false, return null
   * @examples
   * https://bafybeie5gq4jxvzmsym6hjlwxej4rwdoxt7wadqvmmwbqi7r27fclha2va.ipfs.dweb.link => bafybeie5gq4jxvzmsym6hjlwxej4rwdoxt7wadqvmmwbqi7r27fclha2va.ipfs.dweb.link
   * https://github.com/storyprotocol/protocol-core/blob/main/assets/license-image.gif => null
   */
  static parseFilenameFromIPFS(media_uri: string) {
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

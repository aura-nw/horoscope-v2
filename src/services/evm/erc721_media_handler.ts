/* eslint-disable no-param-reassign */
import { AWSError } from 'aws-sdk';
import axios, { AxiosError } from 'axios';
import * as FileType from 'file-type';
import * as isIPFS from 'is-ipfs';
import parse from 'parse-uri';
import Moleculer from 'moleculer';
import { Config } from '../../common';
import { S3Service } from '../../common/utils/s3';

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
// download image/animation from media_uri, then upload to S3
export async function uploadMediaToS3(media_uri?: string) {
  if (media_uri) {
    const fileName = parseFilename(media_uri);
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
        const mediaBuffer = await downloadAttachment(parseIPFSUri(media_uri));
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
export async function updateMediaS3(
  tokenMediaInfo: ITokenMediaInfo,
  logger: Moleculer.LoggerInstance
) {
  try {
    const mediaImageUrl = await uploadMediaToS3(
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
    const mediaAnimationUrl = await uploadMediaToS3(
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
export function parseIPFSUri(uri: string) {
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
export async function getMetadata(token_uri: string): Promise<{
  image?: string;
  animation_url?: string;
}> {
  console.log(parseIPFSUri(token_uri));
  const metadata = await downloadAttachment(parseIPFSUri(token_uri));
  return JSON.parse(metadata.toString());
}

// dowload image/animation from url
export async function downloadAttachment(url: string) {
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
export function parseFilename(media_uri: string) {
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

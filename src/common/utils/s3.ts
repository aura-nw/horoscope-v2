/* eslint-disable @typescript-eslint/naming-convention */
// eslint-disable-next-line import/no-extraneous-dependencies
import AWS from 'aws-sdk';
import { Config } from '..';

const { AWS_SECRET_ACCESS_KEY, AWS_ACCESS_KEY_ID, AWS_REGION } = Config;
export class S3Service {
  private s3Client: AWS.S3;

  public constructor() {
    this.s3Client = new AWS.S3({
      accessKeyId: AWS_ACCESS_KEY_ID,
      region: AWS_REGION,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    });
  }

  public connectS3() {
    return this.s3Client;
  }
}

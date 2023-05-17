/* eslint-disable @typescript-eslint/naming-convention */
// eslint-disable-next-line import/no-extraneous-dependencies
import AWS from 'aws-sdk';
import { Config } from '..';

const { AWS_SECRET_ACCESS_KEY, AWS_ACCESS_KEY_ID, AWS_REGION } = Config;
export class S3Service {
  private static s3Client: AWS.S3;

  public static connectS3() {
    if (this.s3Client) {
      return this.s3Client;
    }
    return new AWS.S3({
      accessKeyId: AWS_ACCESS_KEY_ID,
      region: AWS_REGION,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    });
  }
}

/* eslint-disable @typescript-eslint/naming-convention */
// eslint-disable-next-line import/no-extraneous-dependencies
import AWS from 'aws-sdk';
import config from '../../../config.json' assert { type: 'json' };

export class S3Service {
  private AWS_ACCESS_KEY_ID: string;

  private AWS_SECRET_ACCESS_KEY: string;

  private AWS_REGION: string;

  private S3_CLIENT: any;

  public constructor() {
    this.AWS_ACCESS_KEY_ID = config.s3.awsAccessKeyId;
    this.AWS_SECRET_ACCESS_KEY = config.s3.awsSecretAccessKey;
    this.AWS_REGION = config.s3.awsRegion;
    this.S3_CLIENT = new AWS.S3({
      accessKeyId: this.AWS_ACCESS_KEY_ID,
      region: this.AWS_REGION,
      secretAccessKey: this.AWS_SECRET_ACCESS_KEY,
    });
  }

  public connectS3() {
    return this.S3_CLIENT;
  }
}

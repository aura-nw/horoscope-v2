/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import moleculer, { Context, ServiceBroker } from 'moleculer';
// import { SERVICE } from '../../common';
import BaseService from '../../base/base.service';
import { SERVICE } from '../../common';
import networks from '../../../network.json' assert { type: 'json' };

@Service({
  name: 'verify-contract-evm',
  version: 1,
})
export default class VerifyContractEVM extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Post('/create-request', {
    name: 'create-request',
  })
  async createRequestVerify(ctx: Context) {
    const files: Buffer[] = [];
    return new Promise((resolve, reject) => {
      // @ts-ignore
      ctx.params
        .on('data', (data: Buffer[]) => {
          files.push(...data);
        })
        .on('end', async () => {
          const selectedChain = networks.find(
            // @ts-ignore
            (network) => network.chainId === ctx.meta.$multipart.chainid
          );
          if (!selectedChain) {
            const error = new moleculer.Errors.ValidationError(
              "The 'chainid' field is required and valid."
            );
            reject(error);
          } else {
            try {
              const result = await this.broker.call(
                `${SERVICE.V1.VerifyContractEVM.inputRequestVerify.path}@${selectedChain?.moleculerNamespace}`,
                {
                  // @ts-ignore
                  contract_address: ctx.meta.$multipart.contract_address,
                  // @ts-ignore
                  files,
                  // @ts-ignore
                  creator_tx_hash: ctx.meta.$multipart.creator_tx_hash,
                  // @ts-ignore
                  compiler_version: ctx.meta.$multipart.compiler_version,
                }
              );
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }
        })
        .on('error', (err: any) => {
          reject(err);
        });
    });
  }

  async verifyContract() {
    this.logger.info('verify contract');
    return 'verify contract';
  }
}

/* eslint-disable import/no-extraneous-dependencies */
import { fromBase64, toBech32 } from '@cosmjs/encoding';
import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { aurajsMixin } from '../../mixin/aurajs/aurajs.mixin';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import {
  CONST_CHAR,
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  // MODULE_PARAM,
  SERVICE_NAME,
  // URL_TYPE_CONSTANTS,
} from '../../common/constant';
import { IListAddressesParam } from '../../common/utils/request';
// import Utils from '../../common/utils/utils';
import { Validator } from '../../models/validator';

@Service({
  name: SERVICE_NAME.CRAWL_SIGNING_INFO,
  version: CONST_CHAR.VERSION_NUMBER,
  mixins: [aurajsMixin],
})
export default class CrawlSigningInfoService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: BULL_ACTION_NAME.VALIDATOR_UPSERT,
    params: {
      listAddresses: 'string[]',
    },
  })
  public actionValidatorUpsert(ctx: Context<IListAddressesParam>) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_SIGNING_INFO,
      'crawl',
      {
        listAddresses: ctx.params.listAddresses,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_SIGNING_INFO,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJob(_payload: IListAddressesParam): Promise<void> {
    const lcdClient = await this.getLCDClient();

    const listFoundValidator: Validator[] = await Validator.query()
      .select('*')
      .whereIn('validator.operator_address', _payload.listAddresses);

    // const url = Utils.getUrlByChainIdAndType(
    //   Config.CHAIN_ID,
    //   URL_TYPE_CONSTANTS.LCD
    // );

    const paramSlashing = await lcdClient.cosmos.slashing.v1beta1.params();
    const listBulk: any[] = [];
    await Promise.all(
      listFoundValidator.map(async (foundValidator: Validator) => {
        try {
          const consensusPubkey = foundValidator.consensus_pubkey;
          this.logger.debug(
            `Found validator with address ${foundValidator.operator_address}`
          );
          this.logger.debug(
            `Found validator with consensusPubkey ${consensusPubkey}`
          );

          const address = pubkeyToRawAddress(
            'ed25519',
            fromBase64(consensusPubkey.key.toString())
          );

          const consensusAddress = toBech32(
            `${Config.NETWORK_PREFIX_ADDRESS}${Config.CONSENSUS_PREFIX_ADDRESS}`,
            address
          );
          // const path = `${Config.GET_SIGNING_INFO}/${consensusAddress}`;

          // this.logger.debug(path);
          const result = await lcdClient.cosmos.slashing.v1beta1.signingInfo({
            consAddress: consensusAddress,
          });
          this.logger.debug(result);

          if (result.val_signing_info) {
            let uptime = 0;
            if (paramSlashing?.params) {
              const blockWindow =
                paramSlashing?.params.signed_blocks_window.toString();
              const missedBlock =
                result.val_signing_info.missed_blocks_counter.toString();
              uptime =
                Number(
                  ((BigInt(blockWindow) - BigInt(missedBlock)) *
                    BigInt(100000000)) /
                    BigInt(blockWindow)
                ) / 1000000;
            }

            const updateValidator = foundValidator;
            updateValidator.start_height = Number.parseInt(
              result.val_signing_info.start_height,
              10
            );
            updateValidator.index_offset = Number.parseInt(
              result.val_signing_info.index_offset,
              10
            );
            updateValidator.jailed_until = result.val_signing_info.jailed_until;
            updateValidator.tombstoned = result.val_signing_info.tombstoned;
            updateValidator.missed_blocks_counter = Number.parseInt(
              result.val_signing_info.missed_blocks_counter,
              10
            );
            updateValidator.uptime = uptime;
            listBulk.push(
              Validator.query()
                .insert(updateValidator)
                .onConflict('operator_address')
                .merge()
                .returning('id')
            );
          }
        } catch (error) {
          this.logger.error(error);
        }
      })
    );

    try {
      await Promise.all(listBulk);
    } catch (error) {
      this.logger.error(error);
    }
  }
}

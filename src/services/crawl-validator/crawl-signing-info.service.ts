import { fromBase64, toBech32 } from '@cosmjs/encoding';
import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { callApiMixin } from '../../mixin/callApi/call-api.mixin';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import {
  APP_CONSTANTS,
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  MODULE_PARAM,
  SERVICE_NAME,
  URL_TYPE_CONSTANTS,
} from '../../common/constant';
import { IListAddressesParam } from '../../common/utils/request';
import Utils from '../../common/utils/utils';
import { Param, SlashingParam } from '../../models/param';
import { Validator } from '../../models/validator';
import LIST_NETWORK from '../../../network.json' assert { type: 'json' };

@Service({
  name: SERVICE_NAME.CRAWL_SIGNING_INFO,
  version: APP_CONSTANTS.VERSION_NUMBER,
  mixins: [callApiMixin],
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
    const listFoundValidator: Validator[] = await Validator.query()
      .select('*')
      .whereIn('validator.operator_address', _payload.listAddresses);

    const url = Utils.getUrlByChainIdAndType(
      Config.CHAIN_ID,
      URL_TYPE_CONSTANTS.LCD
    );

    const prefixAddress = LIST_NETWORK.find(
      (item) => item.chainId === Config.CHAIN_ID
    )?.prefixAddress;
    const paramSlashing = await Param.query()
      .select('*')
      .findOne({})
      .where({ module: MODULE_PARAM.SLASHING });
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
            `${prefixAddress}${Config.CONSENSUS_PREFIX_ADDRESS}`,
            address
          );
          const path = `${Config.GET_SIGNING_INFO}/${consensusAddress}`;

          this.logger.debug(path);
          const result = await this.callApiFromDomain(url, path);
          this.logger.debug(result);

          if (result.val_signing_info) {
            let uptime = 0;
            if (paramSlashing?.params instanceof SlashingParam) {
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

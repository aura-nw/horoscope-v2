import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import { fromBase64, fromBech32, toBech32 } from '@cosmjs/encoding';
import { ServiceBroker } from 'moleculer';
import { ChainProperty } from '../../models/chain_property';
import { Validator } from '../../models/validator';
import { Config } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import Utils from '../../common/utils/utils';
import {
  APP_CONSTANTS,
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  SERVICE_NAME,
  URL_TYPE_CONSTANTS,
} from '../../common/constant';
import knex from '../../common/utils/db-connection';
import LIST_NETWORK from '../../../network.json' assert { type: 'json' };
import { callApiMixin } from '../../mixin/callApi/call-api.mixin';

@Service({
  name: SERVICE_NAME.CRAWL_VALIDATOR,
  version: APP_CONSTANTS.VERSION_NUMBER,
  mixins: [callApiMixin],
})
export default class CrawlValidatorService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleCrawlValidator(_payload: object): Promise<void> {
    const listBulk: any[] = [];

    const pathGetAllValidator = `${Config.GET_ALL_VALIDATOR}?pagination.limit=${Config.NUMBER_OF_VALIDATOR_PER_CALL}`;
    const listValidator: any[] = [];

    let param = pathGetAllValidator;
    let resultCallApi;
    let done = false;

    const url = Utils.getUrlByChainIdAndType(
      Config.CHAIN_ID,
      URL_TYPE_CONSTANTS.LCD
    );

    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      resultCallApi = await this.callApiFromDomain(url, param);

      listValidator.push(...resultCallApi.validators);
      if (resultCallApi.pagination.next_key === null) {
        done = true;
      } else {
        param = `${pathGetAllValidator}&pagination.key=${encodeURIComponent(
          resultCallApi.pagination.next_key.toString()
        )}`;
      }
    }
    this.logger.info(
      `Result get validator from LCD: ${JSON.stringify(listValidator)}`
    );

    const listValidatorInDB: Validator[] = await knex('validator').select('*');

    await Promise.all(
      listValidator.map(async (validator) => {
        const foundValidator = listValidatorInDB.find(
          (validatorInDB: Validator) =>
            validatorInDB.operator_address === validator.operator_address
        );

        let validatorEntity: Validator;
        if (!foundValidator) {
          const prefixAddress = LIST_NETWORK.find(
            (item) => item.chainId === Config.CHAIN_ID
          )?.prefixAddress;
          const consensusAddress: string = toBech32(
            `${prefixAddress}${Config.CONSENSUS_PREFIX_ADDRESS}`,
            pubkeyToRawAddress(
              'ed25519',
              fromBase64(validator.consensus_pubkey.key.toString())
            )
          );
          const accountAddress = toBech32(
            Config.NETWORK_PREFIX_ADDRESS,
            fromBech32(validator.operator_address).data
          );
          const consensusPubkey = {
            type: validator.consensus_pubkey['@type'],
            key: validator.consensus_pubkey.key,
          };

          validatorEntity = Validator.fromJson({
            operator_address: validator.operator_address,
            account_address: accountAddress,
            consensus_address: consensusAddress,
            consensus_pubkey: consensusPubkey,
            jailed: validator.jailed,
            status: validator.status,
            tokens: Number.parseInt(validator.tokens, 10),
            delegator_shares: Number.parseInt(validator.delegator_shares, 10),
            description: validator.description,
            unbonding_height: Number.parseInt(validator.unbonding_height, 10),
            unbonding_time: validator.unbonding_time,
            commission: validator.commission,
            min_self_delegation: Number.parseInt(
              validator.min_self_delegation,
              10
            ),
            uptime: 0,
            self_delegation_balance: 0,
            percent_voting_power: 0,
            start_height: 0,
            index_offset: 0,
            jailed_until: '',
            tombstoned: false,
            missed_blocks_counter: 0,
          });
        } else {
          validatorEntity = foundValidator;
          validatorEntity.jailed = validator.jailed;
          validatorEntity.status = validator.status;
          validatorEntity.tokens = validator.tokens;
          validatorEntity.delegator_shares = validator.delegator_shares;
          validatorEntity.unbonding_height = Number.parseInt(
            validator.unbonding_height,
            10
          );
          validatorEntity.unbonding_time = validator.unbonding_time;
          validatorEntity.commission = validator.commission;
          validatorEntity.jailed_until = new Date(
            validatorEntity.jailed_until
          ).toISOString();
        }

        const [selfDelegationBalance, percentVotingPower]: [string, number] =
          await this.loadCustomInfo(
            validatorEntity.operator_address,
            validatorEntity.account_address,
            validatorEntity.tokens
          );
        validatorEntity.self_delegation_balance = selfDelegationBalance;
        validatorEntity.percent_voting_power = percentVotingPower;

        listBulk.push(
          Validator.query()
            .insert(validatorEntity)
            .onConflict('operator_address')
            .merge()
            .returning('id')
        );
      })
    );

    try {
      await Promise.all(listBulk);

      const listAddresses: string[] = listValidator.map((validator) =>
        validator.operator_address.toString()
      );
      if (listAddresses.length > 0)
        this.broker.call(
          `v1.CrawlSigningInfoService.${BULL_ACTION_NAME.VALIDATOR_UPSERT}`,
          { listAddresses }
        );
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async loadCustomInfo(
    operatorAddress: string,
    accountAddress: string,
    tokens: string
  ): Promise<[string, number]> {
    let selfDelegationBalance = '';
    let percentVotingPower = 0;
    try {
      const url = Utils.getUrlByChainIdAndType(
        Config.CHAIN_ID,
        URL_TYPE_CONSTANTS.LCD
      );

      const pathSelfDelegation = `${Config.GET_ALL_VALIDATOR}/${operatorAddress}/delegations/${accountAddress}`;

      const resultSelfBonded = await this.callApiFromDomain(
        url,
        pathSelfDelegation,
        1
      );
      if (
        resultSelfBonded &&
        resultSelfBonded.delegation_response &&
        resultSelfBonded.delegation_response.balance
      ) {
        selfDelegationBalance =
          resultSelfBonded.delegation_response.balance.amount;
      }

      const chainProperty = await ChainProperty.query().select('*').findOne({});
      if (chainProperty) {
        percentVotingPower =
          Number(
            (BigInt(tokens) * BigInt(100000000)) /
              BigInt(chainProperty.pool.bonded_tokens)
          ) / 1000000;
      }
      this.logger.debug(`result: ${JSON.stringify(resultSelfBonded)}`);
    } catch (error) {
      this.logger.error(error);
    }

    return [selfDelegationBalance, percentVotingPower];
  }

  public async _start() {
    await this.broker.waitForServices([
      `${APP_CONSTANTS.VERSION}.${SERVICE_NAME.CRAWL_SIGNING_INFO}`,
    ]);

    this.createJob(
      BULL_JOB_NAME.CRAWL_VALIDATOR,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: parseInt(Config.MILISECOND_CRAWL_VALIDATOR, 10),
        },
      }
    );

    return super._start();
  }
}

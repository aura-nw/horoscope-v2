/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Long from 'long';
import {
  fromBase64,
  fromBech32,
  toBase64,
  toBech32,
  toHex,
} from '@cosmjs/encoding';
import { Secp256k1 } from '@cosmjs/crypto';
import axios from 'axios';
import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import { keccak256 } from 'viem';
import { Validator } from '../../../../models/validator';
import BullableService, {
  QueueHandler,
} from '../../../../base/bullable.service';
import config from '../../../../../config.json' assert { type: 'json' };
import { BULL_JOB_NAME, SERVICE } from '../../../../common';
import networks from '../../../../../network.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.CrawlValidatorService.key,
  version: 1,
})
export default class CrawlValidatorService extends BullableService {
  private selectedChain: any = networks.find(
    (network) => network.chainId === config.chainId
  );

  private _lcd = this.selectedChain.LCD[0];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR,
    jobName: BULL_JOB_NAME.CRAWL_VALIDATOR,
  })
  public async handleCrawlAllValidator(_payload: object): Promise<void> {
    this.logger.info('Crawl validator info in story protocol');
    const updateValidators: Validator[] = await this.getFullInfoValidators();
    if (updateValidators.length > 0) {
      for (let i = 0; i < updateValidators.length; i += 500) {
        const chunk = updateValidators.slice(i, i + 500);
        await Validator.query()
          .insert(chunk)
          .onConflict('operator_address')
          .merge()
          .returning('id')
          .catch((error) => {
            this.logger.error('Error insert or update validators');
            this.logger.error(error);
          });
      }
    }
  }

  private async getFullInfoValidators(): Promise<Validator[]> {
    const updateValidators: Validator[] = [];
    const validators: any[] = [];

    let resultCallApi: any;
    let done = false;
    const pagination: any = {
      limit: Long.fromInt(config.crawlValidator.queryPageLimit),
      count_total: true,
    };

    const stakingPoolCallApi: any = await axios({
      baseURL: this._lcd,
      url: '/staking/pool',
      method: 'GET',
    });
    let validatorCount = 0;
    while (!done) {
      resultCallApi = await axios({
        baseURL: this._lcd,
        url: '/staking/validators',
        method: 'GET',
        params: {
          // status: 'BOND_STATUS_BONDED',
          'pagination.limit': pagination.limit,
          'pagination.key': pagination.key,
          'pagination.count_total': pagination.count_total,
        },
      });
      if (
        pagination.key &&
        resultCallApi.data.msg.pagination.next_key === toBase64(pagination.key)
      ) {
        break;
      }
      validators.push(...resultCallApi.data.msg.validators);
      if (
        !resultCallApi.data.msg.pagination.next_key ||
        (validators.length >= validatorCount && validatorCount > 0)
      ) {
        done = true;
      } else {
        if (validatorCount === 0) {
          validatorCount = Number(resultCallApi.data.msg.pagination.total);
        }
        pagination.key = fromBase64(resultCallApi.data.msg.pagination.next_key);
        pagination.count_total = false;
      }
    }

    let validatorInDB: Validator[] = [];

    validatorInDB = await Validator.query()
      .select('*')
      .whereIn('status', ['1', '2', '3']);

    const offchainMapped: Map<string, boolean> = new Map();

    // eslint-disable-next-line array-callback-return
    validators.map((validator) => {
      const foundValidator = validatorInDB.find(
        (val: Validator) => val.operator_address === validator.operator_address
      );

      let validatorEntity: Validator;
      if (!foundValidator) {
        validatorEntity = this.createNewValidator(validator);
      } else {
        // mark this offchain validator is mapped with onchain
        offchainMapped.set(validator.operator_address, true);
        const unCompressPubKey = Secp256k1.uncompressPubkey(
          fromBase64(
            validator.consensus_pubkey.value.compressed_base64_pubkey.toString()
          )
        );
        const evmAddress = `0x${keccak256(unCompressPubKey.slice(1)).slice(
          -40
        )}`;
        validatorEntity = foundValidator;
        validatorEntity.evm_address = evmAddress;
        validatorEntity.consensus_pubkey = validator.consensus_pubkey;
        validatorEntity.jailed = validator.jailed ?? false;
        validatorEntity.status = validator.status;
        validatorEntity.tokens = validator.tokens;
        validatorEntity.percent_voting_power =
          Number(
            (BigInt(validator.tokens) * BigInt(100000000)) /
              BigInt(stakingPoolCallApi.data.msg.pool.bonded_tokens)
          ) / 1000000;
        validatorEntity.delegator_shares = validator.delegator_shares;
        validatorEntity.description = validator.description;
        validatorEntity.unbonding_height = Number.parseInt(
          validator.unbonding_height ?? 0,
          10
        );
        validatorEntity.unbonding_time = validator.unbonding_time;
        validatorEntity.commission = validator.commission;
        validatorEntity.jailed_until = (
          foundValidator.jailed_until as unknown as Date
        )?.toISOString();
      }

      updateValidators.push(validatorEntity);
    });

    // loop all validator not found onchain, update status is UNRECOGNIZED
    validatorInDB
      .filter((val: any) => !offchainMapped.get(val.operator_address))
      .forEach(async (validatorNotOnchain: any) => {
        this.logger.debug(
          'Account not found onchain: ',
          validatorNotOnchain.operator_address
        );
        validatorNotOnchain.status = Validator.STATUS.UNRECOGNIZED;
        validatorNotOnchain.tokens = 0;
        validatorNotOnchain.delegator_shares = 0;
        validatorNotOnchain.percent_voting_power = 0;

        validatorNotOnchain.jailed_until =
          validatorNotOnchain.jailed_until?.toISOString();
        validatorNotOnchain.unbonding_time =
          validatorNotOnchain.unbonding_time?.toISOString();
        updateValidators.push(validatorNotOnchain);
      });
    return updateValidators;
  }

  createNewValidator(validator: any): Validator {
    const consensusAddress: string = toBech32(
      `${config.networkPrefixAddress}${config.consensusPrefixAddress}`,
      pubkeyToRawAddress(
        'secp256k1',
        fromBase64(
          validator.consensus_pubkey.value.compressed_base64_pubkey.toString()
        )
      )
    );
    const consensusHexAddress: string = toHex(
      pubkeyToRawAddress(
        'secp256k1',
        fromBase64(
          validator.consensus_pubkey.value.compressed_base64_pubkey.toString()
        )
      )
    ).toUpperCase();
    const accountAddress = toBech32(
      config.networkPrefixAddress,
      fromBech32(validator.operator_address).data
    );
    const consensusPubkey = {
      type: validator.consensus_pubkey.type,
      value:
        validator.consensus_pubkey.value.compressed_base64_pubkey.toString(),
    };

    const unCompressPubKey = Secp256k1.uncompressPubkey(
      fromBase64(consensusPubkey.value)
    );
    const evmAddress = `0x${keccak256(unCompressPubKey.slice(1)).slice(-40)}`;

    const validatorEntity = Validator.fromJson({
      operator_address: validator.operator_address,
      account_address: accountAddress,
      consensus_address: consensusAddress,
      consensus_hex_address: consensusHexAddress,
      consensus_pubkey: consensusPubkey,
      evm_address: evmAddress,
      jailed: validator.jailed ?? false,
      status: validator.status,
      tokens: validator.tokens,
      delegator_shares: Number.parseInt(validator.delegator_shares, 10),
      description: validator.description,
      unbonding_height: Number.parseInt(validator.unbonding_height ?? 0, 10),
      unbonding_time: validator.unbonding_time,
      commission: validator.commission,
      min_self_delegation: Number.parseInt(validator.min_self_delegation, 10),
      uptime: 0,
      self_delegation_balance: 0,
      percent_voting_power: 0,
      start_height: 0,
      index_offset: 0,
      // TODO:
      // Ajv Format require { type: 'string', format: 'date-time' }
      // But when query Validator from DB, the data returned is of type Date,
      // so it needs to be converted to string to be able to insert into DB
      jailed_until: new Date(0).toISOString(),
      tombstoned: false,
      missed_blocks_counter: 0,
      delegators_count: 0,
      delegators_last_height: 0,
    });

    return validatorEntity;
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_VALIDATOR,
      BULL_JOB_NAME.CRAWL_VALIDATOR,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlValidator.millisecondCrawl ?? undefined,
          pattern: config.crawlValidator.patternCrawl ?? undefined,
        },
      }
    );
    return super._start();
  }
}

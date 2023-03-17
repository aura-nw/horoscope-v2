/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import { fromBase64, fromBech32, toBech32 } from '@cosmjs/encoding';
import { ServiceBroker } from 'moleculer';
import Long from 'long';
import { Validator } from '../../models/validator';
import { Config } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  CONST_CHAR,
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  SERVICE_NAME,
} from '../../common/constant';
import knex from '../../common/utils/db_connection';
import BlockCheckpoint from '../../models/block_checkpoint';
import Block from '../../models/block';
import Transaction from '../../models/transaction';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { IPagination } from '../../common/types/interfaces';

@Service({
  name: SERVICE_NAME.CRAWL_VALIDATOR,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class CrawlValidatorService extends BullableService {
  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleCrawlAllValidator(_payload: object): Promise<void> {
    this._lcdClient = await getLcdClient();

    const listBulk: any[] = [];
    const listValidator: any[] = [];

    const [handleAddressBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('height')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_VALIDATOR),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let lastHeight = 0;
    if (handleAddressBlockCheckpoint)
      lastHeight = handleAddressBlockCheckpoint.height;

    if (latestBlock) {
      const resultTx = await Transaction.query()
        .select('transaction.id', 'transaction.height')
        .join('transaction_event', 'transaction.id', 'transaction_event.tx_id')
        .select('transaction_event.tx_id')
        .join(
          'transaction_event_attribute',
          'transaction_event.id',
          'transaction_event_attribute.event_id'
        )
        .select(
          'transaction_event_attribute.key',
          'transaction_event_attribute.value'
        )
        .where('transaction.height', '>', lastHeight)
        .andWhere('transaction.height', '<=', latestBlock.height)
        .andWhere((builder) =>
          builder.whereIn('transaction_event_attribute.key', [
            CONST_CHAR.VALIDATOR,
            CONST_CHAR.SOURCE_VALIDATOR,
            CONST_CHAR.DESTINATION_VALIDATOR,
          ])
        )
        .limit(1)
        .offset(0);
      this.logger.info(
        `Result get Tx from height ${lastHeight} to ${latestBlock.height}:`
      );
      this.logger.info(JSON.stringify(resultTx));

      if (resultTx.length > 0) {
        let resultCallApi;
        let done = false;
        const pagination: IPagination = {
          limit: Long.fromString(Config.NUMBER_OF_VALIDATOR_PER_CALL, 10),
        };

        while (!done) {
          resultCallApi =
            await this._lcdClient.cosmos.staking.v1beta1.validators({
              pagination,
            });

          listValidator.push(...resultCallApi.validators);
          if (resultCallApi.pagination.next_key === null) {
            done = true;
          } else {
            pagination.key = resultCallApi.pagination.next_key;
          }
        }
        this.logger.info(
          `Result get validator from LCD: ${JSON.stringify(listValidator)}`
        );

        const listValidatorInDB: Validator[] = await knex('validator').select(
          '*'
        );

        await Promise.all(
          listValidator.map(async (validator) => {
            const foundValidator = listValidatorInDB.find(
              (validatorInDB: Validator) =>
                validatorInDB.operator_address === validator.operator_address
            );

            let validatorEntity: Validator;
            if (!foundValidator) {
              const consensusAddress: string = toBech32(
                `${Config.NETWORK_PREFIX_ADDRESS}${Config.CONSENSUS_PREFIX_ADDRESS}`,
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
                delegator_shares: Number.parseInt(
                  validator.delegator_shares,
                  10
                ),
                description: validator.description,
                unbonding_height: Number.parseInt(
                  validator.unbonding_height,
                  10
                ),
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
                jailed_until: new Date(0).toISOString(),
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

            const [selfDelegationBalance, percentVotingPower]: [
              string,
              number
            ] = await this.loadCustomInfo(
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
      const [resultSelfBonded, pool] = await Promise.all([
        this._lcdClient.cosmos.staking.v1beta1.delegation({
          delegatorAddr: accountAddress,
          validatorAddr: `${operatorAddress}/`,
        }),
        this._lcdClient.cosmos.staking.v1beta1.pool(),
      ]);
      if (
        resultSelfBonded &&
        resultSelfBonded.delegation_response &&
        resultSelfBonded.delegation_response.balance
      ) {
        selfDelegationBalance =
          resultSelfBonded.delegation_response.balance.amount;
      }
      if (pool) {
        percentVotingPower =
          Number(
            (BigInt(tokens) * BigInt(100000000)) /
              BigInt(pool.pool.bonded_tokens)
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
      `${CONST_CHAR.VERSION}.${SERVICE_NAME.CRAWL_SIGNING_INFO}`,
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

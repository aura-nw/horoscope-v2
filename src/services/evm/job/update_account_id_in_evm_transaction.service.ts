import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import _ from 'lodash';
import { bytesToHex } from 'viem';
import { Account, BlockCheckpoint, EVMTransaction } from '../../../models';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import config from '../../../../config.json' assert { type: 'json' };
import knex, { batchUpdate } from '../../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.JobService.UpdateAccountIdInEVMTransaction.key,
  version: 1,
})
export default class UpdateAccountIdInEVMTransaction extends BullableService {
  @QueueHandler({
    queueName: BULL_JOB_NAME.UPDATE_ACCOUNT_ID_IN_EVM_TX,
    jobName: BULL_JOB_NAME.UPDATE_ACCOUNT_ID_IN_EVM_TX,
  })
  async updateAccountIdEvmTx() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.UPDATE_ACCOUNT_ID_IN_EVM_TX,
        [BULL_JOB_NAME.CRAWL_EVM_ACCOUNT],
        config.crawlEvmAccount.key
      );
    this.logger.info(
      `Update account id in evm_transaction from block ${startBlock} to ${endBlock}`
    );

    const [fromTx, toTx] = await Promise.all([
      EVMTransaction.query()
        .select('id')
        .findOne('height', '>', startBlock)
        .orderBy('height', 'asc')
        .orderBy('index', 'asc')
        .limit(1),
      EVMTransaction.query()
        .select('id')
        .findOne('height', '<=', endBlock)
        .orderBy('height', 'desc')
        .orderBy('index', 'desc')
        .limit(1),
    ]);

    if (!fromTx || !toTx) {
      const error = 'Cannot found fromTx or toTx';
      this.logger.error(error);
      throw Error(error);
    }

    const txs = await EVMTransaction.query()
      .select('id', 'from', 'to')
      .where('id', '>=', fromTx.id)
      .andWhere('id', '<=', toTx.id);
    const listAddress = txs.flatMap((tx) => [
      tx.from ? bytesToHex(tx.from) : undefined,
      tx.to ? bytesToHex(tx.to) : undefined,
    ]);
    const listAddressUnique = _.uniq(listAddress.filter((e) => e));
    const listAddressDB = _.keyBy(
      await Account.query()
        .select('id', 'evm_address')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .whereIn('evm_address', listAddressUnique),
      'evm_address'
    );

    const listUpdateAccountInTx: any = [];
    txs.forEach((tx) => {
      listUpdateAccountInTx.push({
        id: tx.id,
        from_account_id: {
          type: 'number',
          value: tx.from ? listAddressDB[bytesToHex(tx.from)]?.id : undefined,
        },
        to_account_id: {
          type: 'number',
          value: tx.to ? listAddressDB[bytesToHex(tx.to)]?.id : undefined,
        },
      });
    });
    this.logger.debug(listUpdateAccountInTx);
    await knex.transaction(async (trx) => {
      await batchUpdate(trx, 'evm_transaction', listUpdateAccountInTx, [
        'from_account_id',
        'to_account_id',
      ]);
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;
        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .transacting(trx);
      }
    });
  }

  async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.UPDATE_ACCOUNT_ID_IN_EVM_TX,
      BULL_JOB_NAME.UPDATE_ACCOUNT_ID_IN_EVM_TX,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.updateAccountIdInEVMTransaction.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}

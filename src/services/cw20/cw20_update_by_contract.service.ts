import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { Knex } from 'knex';
import _ from 'lodash';
import knex from '../../common/utils/db_connection';
import { CW20Holder, Cw20Contract, Cw20Event } from '../../models';
import { BULL_JOB_NAME, IContextUpdateCw20, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import { CW20_ACTION } from './cw20.service';

export interface ICw20UpdateByContractParam {
  cw20ContractId: number;
  startBlock: number;
  endBlock: number;
}

@Service({
  name: SERVICE.V1.Cw20UpdateByContract.key,
  version: 1,
})
export default class Cw20UpdateByContractService extends BullableService {
  _blocksPerBatch!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CW20_UPDATE_BY_CONTRACT,
    jobName: BULL_JOB_NAME.CW20_UPDATE_BY_CONTRACT,
  })
  async jobHandle(_payload: ICw20UpdateByContractParam): Promise<void> {
    const { cw20ContractId, startBlock, endBlock } = _payload;
    // get all cw20_events from startBlock to endBlock and they occur after cw20 last_updated_height (max holders's last_updated_height)
    const newEvents = await Cw20Event.query()
      .where('cw20_contract_id', cw20ContractId)
      .andWhere('height', '>', startBlock)
      .andWhere('height', '<=', endBlock);
    if (newEvents.length > 0) {
      await knex.transaction(async (trx) => {
        await this.updateTotalSupply(newEvents, cw20ContractId, endBlock, trx);
        await this.updateBalanceHolders(newEvents, cw20ContractId, trx);
      });
    }
  }

  @Action({
    name: SERVICE.V1.Cw20UpdateByContract.UpdateByContract.key,
    params: {
      cw20Contracts: 'any[]',
      startBlock: 'any',
      endBlock: 'any',
    },
  })
  async UpdateByContract(ctx: Context<IContextUpdateCw20>) {
    const { startBlock, endBlock } = ctx.params;
    // eslint-disable-next-line no-restricted-syntax
    for (const cw20Contract of ctx.params.cw20Contracts) {
      const startUpdateBlock = Math.min(
        startBlock,
        cw20Contract.last_updated_height
      );
      if (startUpdateBlock < endBlock) {
        // eslint-disable-next-line no-await-in-loop
        await this.createJob(
          BULL_JOB_NAME.CW20_UPDATE_BY_CONTRACT,
          BULL_JOB_NAME.CW20_UPDATE_BY_CONTRACT,
          {
            cw20ContractId: cw20Contract.id,
            startBlock: startUpdateBlock,
            endBlock,
          },
          {
            removeOnComplete: true,
            attempts: config.jobRetryAttempt,
            backoff: config.jobRetryBackoff,
          }
        );
      }
    }
  }

  async updateTotalSupply(
    cw20Events: Cw20Event[],
    cw20ContractId: number,
    endBlock: number,
    trx: Knex.Transaction
  ) {
    let addAmount = BigInt(0);
    // add mint amount
    const cw20MintEvents = cw20Events.filter(
      (event) => event.action === CW20_ACTION.MINT
    );
    cw20MintEvents.forEach((mintEvent) => {
      if (mintEvent.amount) {
        addAmount = BigInt(addAmount) + BigInt(mintEvent.amount);
      } else {
        throw new Error(`Mint event id ${mintEvent.id} not found amount`);
      }
    });
    // sub burn amount
    const cw20BurnEvents = cw20Events.filter(
      (event) => event.action === CW20_ACTION.BURN
    );
    cw20BurnEvents.forEach((burnEvent) => {
      if (burnEvent.amount) {
        addAmount = BigInt(addAmount) - BigInt(`${burnEvent.amount}`);
      } else {
        throw new Error(`Burn event id ${burnEvent.id} not found amount`);
      }
    });
    // get and update total amount in cw20 contract
    const cw20Contract = await Cw20Contract.query()
      .transacting(trx)
      .where('id', cw20ContractId)
      .first()
      .throwIfNotFound();
    const updateTotalSupply =
      BigInt(addAmount) + BigInt(cw20Contract.total_supply);
    await Cw20Contract.query()
      .transacting(trx)
      .where('id', cw20ContractId)
      .patch({
        total_supply: updateTotalSupply.toString(),
        last_updated_height: endBlock,
      });
  }

  async updateBalanceHolders(
    cw20Events: Cw20Event[],
    cw20ContractId: number,
    trx: Knex.Transaction
  ) {
    // just get base action which change balance: MINT, BURN, TRANSFER, SEND
    const orderEvents = _.orderBy(
      cw20Events.filter(
        (event) =>
          event.action === CW20_ACTION.MINT ||
          event.action === CW20_ACTION.BURN ||
          event.action === CW20_ACTION.TRANSFER ||
          event.action === CW20_ACTION.SEND
      ),
      ['height'],
      ['asc']
    );
    // get all holders send/receive in DB
    const holders = _.keyBy(
      await CW20Holder.query()
        .transacting(trx)
        .whereIn(
          'address',
          orderEvents.reduce((acc: string[], curr) => {
            if (curr.from) {
              acc.push(curr.from);
            }
            if (curr.to) {
              acc.push(curr.to);
            }
            return acc;
          }, [])
        )
        .andWhere('cw20_contract_id', cw20ContractId),
      'address'
    );
    // update balance holders to holders
    orderEvents.forEach((event) => {
      // if event not have amount, throw error
      if (event.amount) {
        // sender event
        if (
          event.from &&
          event.height > holders[event.from].last_updated_height
        ) {
          holders[event.from] = CW20Holder.fromJson({
            amount: (
              BigInt(holders[event.from].amount) - BigInt(event.amount)
            ).toString(),
            last_updated_height: event.height,
            cw20_contract_id: cw20ContractId,
            address: event.from,
          });
        }
        // recipient event
        if (
          event.to &&
          event.height > (holders[event.to]?.last_updated_height || 0)
        ) {
          holders[event.to] = CW20Holder.fromJson({
            amount: (
              BigInt(holders[event.to]?.amount || 0) + BigInt(event.amount)
            ).toString(),
            last_updated_height: event.height,
            cw20_contract_id: cw20ContractId,
            address: event.to,
          });
        }
      } else {
        throw new Error(`handle event ${event.id} not found amount`);
      }
    });
    if (Object.keys(holders).length > 0) {
      await CW20Holder.query()
        .transacting(trx)
        .insert(
          Object.keys(holders).map((address) =>
            CW20Holder.fromJson({
              address,
              amount: holders[address].amount,
              last_updated_height: holders[address].last_updated_height,
              cw20_contract_id: cw20ContractId,
            })
          )
        )
        .onConflict(['cw20_contract_id', 'address'])
        .merge();
    }
  }
}

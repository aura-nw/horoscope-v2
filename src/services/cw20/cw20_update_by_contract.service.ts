import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { Knex } from 'knex';
import _, { Dictionary } from 'lodash';
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
interface IAddBalanceHolder {
  address: string;
  amount: string;
  last_updated_height: number;
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
    let { startBlock } = ctx.params;
    const { endBlock } = ctx.params;
    // eslint-disable-next-line no-restricted-syntax
    for (const cw20Contract of ctx.params.cw20Contracts) {
      if (startBlock < cw20Contract.last_updated_height) {
        startBlock = cw20Contract.last_updated_height;
      }
      if (startBlock < endBlock) {
        // eslint-disable-next-line no-await-in-loop
        await this.createJob(
          BULL_JOB_NAME.CW20_UPDATE_BY_CONTRACT,
          BULL_JOB_NAME.CW20_UPDATE_BY_CONTRACT,
          {
            cw20ContractId: cw20Contract.id,
            startBlock,
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
    let addAmount = '0';
    // add mint amount
    const cw20MintEvents = cw20Events.filter(
      (event) => event.action === CW20_ACTION.MINT
    );
    cw20MintEvents.forEach((mintEvent) => {
      if (mintEvent.amount) {
        addAmount = (BigInt(addAmount) + BigInt(mintEvent.amount)).toString();
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
        addAmount = (
          BigInt(addAmount) - BigInt(`${burnEvent.amount}`)
        ).toString();
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
    const updateTotalSupply = (
      BigInt(addAmount) + BigInt(cw20Contract.total_supply)
    ).toString();
    await Cw20Contract.query()
      .transacting(trx)
      .where('id', cw20ContractId)
      .patch({
        total_supply: updateTotalSupply,
        last_updated_height: endBlock,
      });
  }

  async updateBalanceHolders(
    cw20Events: Cw20Event[],
    cw20ContractId: number,
    trx: Knex.Transaction
  ) {
    const addBalanceHolders: Dictionary<IAddBalanceHolder> = {};
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
    // update fluctuate balance holders to addBalanceHolders
    orderEvents.forEach((event) => {
      // if event not have amount, throw error
      if (event.amount) {
        // sender
        if (event.from) {
          if (addBalanceHolders[event.from]) {
            // sub balance for sender
            addBalanceHolders[event.from].amount = (
              BigInt(addBalanceHolders[event.from].amount) -
              BigInt(`${event.amount}`)
            ).toString();
            addBalanceHolders[event.from].last_updated_height = event.height;
          } else {
            addBalanceHolders[event.from] = {
              address: event.from,
              amount: `-${event.amount}`,
              last_updated_height: event.height,
            };
          }
        }
        // recipient
        if (event.to) {
          if (addBalanceHolders[event.to]) {
            // add balance for recipient
            addBalanceHolders[event.to].amount = (
              BigInt(addBalanceHolders[event.to].amount) + BigInt(event.amount)
            ).toString();
            addBalanceHolders[event.to].last_updated_height = event.height;
          } else {
            addBalanceHolders[event.to] = {
              address: event.to,
              amount: event.amount,
              last_updated_height: event.height,
            };
          }
        }
      } else {
        throw new Error(`handle event ${event.id} not found amount`);
      }
    });
    if (Object.keys(addBalanceHolders).length > 0) {
      const holders = _.keyBy(
        await CW20Holder.query()
          .transacting(trx)
          .whereIn('address', Object.keys(addBalanceHolders))
          .andWhere('cw20_contract_id', cw20ContractId),
        'address'
      );
      await CW20Holder.query()
        .transacting(trx)
        .insert(
          Object.keys(addBalanceHolders).map((address) =>
            CW20Holder.fromJson({
              address,
              amount: (
                BigInt(holders[address] ? holders[address].amount : '0') +
                BigInt(addBalanceHolders[address].amount)
              ).toString(),
              last_updated_height:
                addBalanceHolders[address].last_updated_height,
              cw20_contract_id: cw20ContractId,
            })
          )
        )
        .onConflict(['cw20_contract_id', 'address'])
        .merge();
    }
  }

  async _start(): Promise<void> {
    return super._start();
  }
}

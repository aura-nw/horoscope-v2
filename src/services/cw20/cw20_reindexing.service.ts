import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import _ from 'lodash';
import { Context, ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, IContextUpdateCw20, SERVICE } from '../../common';
import {
  CW20Holder,
  CW20TotalHolderStats,
  Cw20Contract,
  Cw20Event,
  IHolderEvent,
  SmartContract,
} from '../../models';
import { ICw20ReindexingHistoryParams } from './cw20.service';

export interface IAddressParam {
  contractAddress: string;
}
interface ICw20ReindexingParams {
  contractAddress: string;
  smartContractId: number;
}
@Service({
  name: SERVICE.V1.Cw20ReindexingService.key,
  version: 1,
})
export default class Cw20CrawlMissingContract extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.Cw20ReindexingService.Reindexing.key,
    params: {
      contractAddress: 'string',
    },
  })
  public async reindexing(ctx: Context<IAddressParam>) {
    const { contractAddress } = ctx.params;
    const smartContract = await SmartContract.query()
      .withGraphJoined('code')
      .where('address', contractAddress)
      .first()
      .throwIfNotFound();

    // check whether contract is Cw20 type -> throw error to user
    if (smartContract.code.type === 'CW20') {
      await this.createJob(
        BULL_JOB_NAME.REINDEX_CW20_CONTRACT,
        BULL_JOB_NAME.REINDEX_CW20_CONTRACT,
        {
          contractAddress,
          smartContractId: smartContract.id,
        } satisfies ICw20ReindexingParams,
        {
          jobId: contractAddress,
        }
      );
    } else {
      throw new Error(
        `Smart contract ${ctx.params.contractAddress} is not CW20 type`
      );
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.REINDEX_CW20_CONTRACT,
    jobName: BULL_JOB_NAME.REINDEX_CW20_CONTRACT,
  })
  async jobHandler(_payload: ICw20ReindexingParams): Promise<void> {
    const { smartContractId, contractAddress } = _payload;
    const cw20Contract = await Cw20Contract.query()
      .withGraphJoined('smart_contract')
      .where('smart_contract.address', contractAddress)
      .select(['cw20_contract.id'])
      .first();
    // query
    const contractInfo = (
      await Cw20Contract.getContractsInfo([contractAddress])
    )[0];
    let track = true;
    let initBalances: IHolderEvent[] = [];
    // get init address holder, init amount
    try {
      initBalances = await Cw20Contract.getInstantiateBalances(contractAddress);
    } catch (error) {
      track = false;
    }
    const minUpdatedHeightOwner =
      _.min(initBalances.map((holder) => holder.event_height)) || 0;
    const maxUpdatedHeightOwner =
      _.max(initBalances.map((holder) => holder.event_height)) || 0;
    if (cw20Contract) {
      await Cw20Event.query()
        .delete()
        .where('cw20_contract_id', cw20Contract.id);
      await CW20TotalHolderStats.query()
        .delete()
        .where('cw20_contract_id', cw20Contract.id);
      await CW20Holder.query()
        .delete()
        .where('cw20_contract_id', cw20Contract.id);
      await Cw20Contract.query().deleteById(cw20Contract.id);
    }
    const newCw20Contract = await Cw20Contract.query().insertGraph({
      ...Cw20Contract.fromJson({
        smart_contract_id: smartContractId,
        symbol: contractInfo?.symbol,
        minter: contractInfo?.minter,
        marketing_info: contractInfo?.marketing_info,
        name: contractInfo?.name,
        total_supply: initBalances.reduce(
          (acc: string, curr: { address: string; amount: string }) =>
            (BigInt(acc) + BigInt(curr.amount)).toString(),
          '0'
        ),
        track,
        decimal: contractInfo?.decimal,
        last_updated_height: minUpdatedHeightOwner,
      }),
      holders: initBalances.map((e) => ({
        address: e.address,
        amount: e.amount,
        last_updated_height: e.event_height,
      })),
    });
    // handle from minUpdatedHeightOwner to blockHeight
    await this.broker.call(
      SERVICE.V1.Cw20UpdateByContract.UpdateByContract.path,
      {
        cw20Contracts: [
          {
            id: newCw20Contract.id,
            last_updated_height: newCw20Contract.last_updated_height,
          },
        ],
        startBlock: minUpdatedHeightOwner,
        endBlock: maxUpdatedHeightOwner,
      } satisfies IContextUpdateCw20
    );
    // insert histories
    await this.createJob(
      BULL_JOB_NAME.REINDEX_CW20_HISTORY,
      BULL_JOB_NAME.REINDEX_CW20_HISTORY,
      {
        smartContractId,
        startBlock: config.crawlBlock.startBlock,
        endBlock: maxUpdatedHeightOwner,
        prevId: 0,
        contractAddress,
      } satisfies ICw20ReindexingHistoryParams,
      {
        removeOnComplete: true,
      }
    );
  }

  async _start(): Promise<void> {
    await this.broker.waitForServices([
      SERVICE.V1.Cw20.name,
      SERVICE.V1.Cw20UpdateByContract.name,
    ]);
    return super._start();
  }
}

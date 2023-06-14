import { cosmwasm } from '@aura-nw/aurajs';
import { fromBase64, fromUtf8, toHex, toUtf8 } from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import knex from '../../common/utils/db_connection';
import {
  BlockCheckpoint,
  CW20Holder,
  Cw20Contract,
  EventAttribute,
} from '../../models';
import { SmartContractEvent } from '../../models/smart_contract_event';
import { getAttributeFrom } from '../../common/utils/smart_contract';

const { NODE_ENV } = Config;
const CW20_ACTION = {
  MINT: 'mint',
  BURN: 'burn',
  TRANSFER: 'transfer',
  INSTANTIATE: 'instantiate',
};

interface IContractInfo {
  address: string;
  symbol: string;
  minter: string;
  decimal: number;
  marketing_info: any;
  name: string;
}

interface IHolderEvent {
  address: string;
  amount: string;
  contract_address: string;
  event_height?: number;
}

@Service({
  name: SERVICE.V1.Cw20.key,
  version: 1,
})
export default class Cw20Service extends BullableService {
  _httpBatchClient!: HttpBatchClient;

  _blocksPerBatch!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_CW20,
    jobName: BULL_JOB_NAME.HANDLE_CW20,
  })
  async jobHandleCw20(): Promise<void> {
    // get range txs for proccessing
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_CW20,
        [BULL_JOB_NAME.CRAWL_SMART_CONTRACT],
        config.cw20.key
      );
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    if (startBlock >= endBlock) return;
    // get all contract Msg in above range blocks
    const cw20Events = await this.getCw20ContractEvents(startBlock, endBlock);
    this.logger.info(cw20Events);
    await knex.transaction(async (trx) => {
      if (cw20Events.length > 0) {
        // handle instantiate cw20 contracts
        await this.handleCw20Instantiate(
          cw20Events.filter(
            (event) => event.action === CW20_ACTION.INSTANTIATE
          ),
          trx
        );
        // handle all cw20 execute
        // await this.handleCw20Exec(
        //   cw20Events.filter((msg) => msg.action !== CW20_ACTION.INSTANTIATE),
        //   trx
        // );
        // handle Cw721 Activity
        // await this.handleCW20Activity(cw20Events);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
  }

  // insert new cw20 contract + instantiate holders
  async handleCw20Instantiate(
    cw20InstantiateEvents: SmartContractEvent[],
    trx: Knex.Transaction
  ) {
    if (cw20InstantiateEvents.length > 0) {
      const contractsInfo = await this.getContractsInfo(
        cw20InstantiateEvents.map((event) => event.contract_address)
      );
      const instantiateContracts = await Promise.all(
        cw20InstantiateEvents.map(async (event) => {
          const contractInfo = contractsInfo.find(
            (result) => result.address === event.contract_address
          );
          // get init address holder, init amount
          const initBalances = await this.getInstantiateBalances(
            event.contract_address
          );
          return {
            ...Cw20Contract.fromJson({
              smart_contract_id: event.smart_contract_id,
              symbol: contractInfo?.symbol,
              minter: contractInfo?.minter,
              marketing_info: contractInfo?.marketing_info,
              name: contractInfo?.name,
              total_supply: initBalances.reduce(
                (acc: string, curr: { address: string; amount: string }) =>
                  (BigInt(acc) + BigInt(curr.amount)).toString(),
                '0'
              ),
            }),
            holders: initBalances.map((e) => ({
              address: e.address,
              amount: e.amount,
              last_updated_height: e.event_height,
            })),
          };
        })
      );
      await Cw20Contract.query()
        .insertGraph(instantiateContracts)
        .transacting(trx);
    }
  }

  // filter type of exec => handle
  async handleCw20Exec(
    cw20ExecEvents: SmartContractEvent[],
    trx: Knex.Transaction
  ) {
    // handle mint
    await this.handleCw20Mint(
      cw20ExecEvents.filter((event) => event.action === CW20_ACTION.MINT),
      trx
    );
    // handle transfer
    await this.handleCw20Transfer(
      cw20ExecEvents.filter((event) => event.action === CW20_ACTION.TRANSFER)
    );
    // handle burn
    await this.handleCw721Burn(
      cw20ExecEvents.filter((event) => event.action === CW20_ACTION.BURN)
    );
  }

  // Add balance to cw20_holder and total_supply to cw20_contract
  async handleCw20Mint(
    mintEvents: SmartContractEvent[],
    trx: Knex.Transaction
  ): Promise<void> {
    if (mintEvents.length > 0) {
      // get all holders events, and order by event_height: amount token to address
      const holderEvents: IHolderEvent[] = _.orderBy(
        mintEvents.map((event) => ({
          address: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.TO
          ),
          amount: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.AMOUNT
          ),
          contract_address: event.contract_address,
          event_height: event.height,
        })),
        ['event_height'],
        ['asc']
      );
      // update holder balance queries
      const queries: any[] = [];
      // get all related holders in DB
      const holders = await CW20Holder.query()
        .transacting(trx)
        .withGraphJoined('smart_contract')
        .whereIn(
          ['address', 'smart_contract.address'],
          holderEvents.map((event) => [event.address, event.contract_address])
        )
        .select('address', 'smart_contract.address as contract_address');
      // get all related cw20_contract in DB for updating total_supply
      const cw20Contracts = await Cw20Contract.query()
        .transacting(trx)
        .withGraphJoined('smart_contract')
        .whereIn(
          'smart_contract.address',
          holderEvents.map((event) => event.contract_address)
        );
      // for each cw20 contracts
      cw20Contracts.forEach((cw20Contract) => {
        let totalSupply = cw20Contract.total_supply;
        // filter holders those cw20 tokens for processing
        holders
          .filter(
            (holder) =>
              holder.contract_address === cw20Contract.contract_address
          )
          .forEach((holder) => {
            let balance = holder.amount;
            const lastUpdatedHeight = holder.last_updated_height;
            // get all holder event belong to this holder, check whether event height > last_updated_height then add amount balance
            holderEvents
              .filter(
                (event) =>
                  event.address === holder.address &&
                  event.contract_address === holder.contract_address &&
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  lastUpdatedHeight < holderEvent.event_height
              )
              .forEach((event) => {
                balance = (BigInt(balance) + BigInt(event.amount)).toString();
                totalSupply = (
                  BigInt(totalSupply) + BigInt(event.amount)
                ).toString();
              });
            queries.push(
              CW20Holder.query()
                .patch({
                  amount: balance,
                })
                .where({
                  id: holder.id,
                })
                .transacting(trx)
            );
          });
        queries.push(
          Cw20Contract.query()
            .patch({
              total_supply: totalSupply,
            })
            .where({
              id: cw20Contract.id,
            })
            .transacting(trx)
        );
      });
      if (queries.length > 0) {
        await Promise.all(queries);
      }
    }
  }

  async getCw20ContractEvents(startBlock: number, endBlock: number) {
    return SmartContractEvent.query()
      .alias('smart_contract_event')
      .withGraphJoined(
        '[message(selectMessage), tx(selectTransaction), attributes(selectAttribute), smart_contract(selectSmartContract).code(selectCode)]'
      )
      .modifiers({
        selectCode(builder) {
          builder.select('type');
        },
        selectTransaction(builder) {
          builder.select('hash', 'height');
        },
        selectMessage(builder) {
          builder.select('sender', 'content');
        },
        selectAttribute(builder) {
          builder.select('key', 'value');
        },
        selectSmartContract(builder) {
          builder.select('address', 'id');
        },
      })
      .where('smart_contract:code.type', 'CW20')
      .where('tx.height', '>', startBlock)
      .andWhere('tx.height', '<=', endBlock)
      .select(
        'message.sender as sender',
        'smart_contract.address as contract_address',
        'smart_contract_event.action',
        'smart_contract_event.event_id',
        'smart_contract_event.index',
        'smart_contract.id as smart_contract_id',
        'tx.height as height'
      );
  }

  // get contract info (minter, symbol, decimal, marketing_info) by query rpc
  async getContractsInfo(
    contractAddresses: string[]
  ): Promise<IContractInfo[]> {
    const promisesInfo: any[] = [];
    const promisesMinter: any[] = [];
    const promisesMarketingInfo: any[] = [];
    contractAddresses.forEach((address: string) => {
      promisesInfo.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                queryData: toUtf8('{"token_info":{}}'),
              }).finish()
            ),
          })
        )
      );
      promisesMinter.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                queryData: toUtf8('{"minter":{}}'),
              }).finish()
            ),
          })
        )
      );
      promisesMarketingInfo.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address,
                queryData: toUtf8('{"marketing_info":{}}'),
              }).finish()
            ),
          })
        )
      );
    });
    const contractsInfo: IContractInfo[] = [];
    const resultsContractsInfo: JsonRpcSuccessResponse[] = await Promise.all(
      promisesInfo
    );
    const resultsMinters: JsonRpcSuccessResponse[] = await Promise.all(
      promisesMinter
    );
    const resultsMarketingInfo: JsonRpcSuccessResponse[] = await Promise.all(
      promisesMarketingInfo
    );
    for (let index = 0; index < resultsContractsInfo.length; index += 1) {
      const contractInfo = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(resultsContractsInfo[index].result.response.value)
          ).data
        )
      );
      const { minter }: { minter: string } = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(resultsMinters[index].result.response.value)
          ).data
        )
      );
      const marketingInfo = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(resultsMarketingInfo[index].result.response.value)
          ).data
        )
      );
      contractsInfo.push({
        address: contractAddresses[index],
        symbol: contractInfo.symbol as string,
        minter,
        decimal: contractInfo.decimals as number,
        marketing_info: marketingInfo,
        name: contractInfo.name,
      });
    }
    return contractsInfo;
  }

  // get instantiate balances
  async getInstantiateBalances(
    contractAddress: string
  ): Promise<IHolderEvent[]> {
    const holders: IHolderEvent[] = [];
    // get all owners of cw20 contract
    let startAfter = null;
    do {
      let query = '{"all_accounts":{}}';
      if (startAfter) {
        query = `{"all_accounts":{"start_after":"${startAfter}"}}`;
      }
      // eslint-disable-next-line no-await-in-loop
      const result = await this._httpBatchClient.execute(
        createJsonRpcRequest('abci_query', {
          path: '/cosmwasm.wasm.v1.Query/SmartContractState',
          data: toHex(
            cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
              address: contractAddress,
              queryData: toUtf8(query),
            }).finish()
          ),
        })
      );
      const { accounts } = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(result.result.response.value)
          ).data
        )
      );
      if (accounts.length > 0) {
        accounts.forEach((account: string) => {
          holders.push({
            address: account,
            amount: '',
            contract_address: contractAddress,
          });
        });
        startAfter = accounts[accounts.length - 1];
      } else {
        startAfter = null;
      }
    } while (startAfter);
    const promiseBalanceHolders: any[] = [];
    holders.forEach((holder) => {
      promiseBalanceHolders.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmwasm.wasm.v1.Query/SmartContractState',
            data: toHex(
              cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                address: contractAddress,
                queryData: toUtf8(
                  `{"balance":{"address":"${holder.address}"}}`
                ),
              }).finish()
            ),
          })
        )
      );
    });
    const result: JsonRpcSuccessResponse[] = await Promise.all(
      promiseBalanceHolders
    );
    holders.forEach((holder, index) => {
      const { balance }: { balance: string } = JSON.parse(
        fromUtf8(
          cosmwasm.wasm.v1.QuerySmartContractStateResponse.decode(
            fromBase64(result[index].result.response.value)
          ).data
        )
      );
      // eslint-disable-next-line no-param-reassign
      holder.amount = balance;
      // eslint-disable-next-line no-param-reassign
      holder.event_height = parseInt(result[index].result.response.height, 10);
    });
    return holders;
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.HANDLE_CW20,
        BULL_JOB_NAME.HANDLE_CW20,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.cw20.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }
}

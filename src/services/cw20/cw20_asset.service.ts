import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import {
  fromBase64,
  fromUtf8,
  toBase64,
  toHex,
  toUtf8,
} from '@cosmjs/encoding';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { cosmwasm } from '@aura-nw/aurajs';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { CW20Holder, ICW20AssetInfo, ICW20MarketingInfo } from '../../models';
import { BULL_JOB_NAME } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { getHttpBatchClient } from '../../common/utils/cosmjs_client';

@Service({
  name: 'CW20',
  version: 1,
})
export default class CW20AssetService extends BullableService {
  private _httpBatchClient: HttpBatchClient;

  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  // confirmed
  @QueueHandler({
    queueName: BULL_JOB_NAME.ENRICH_CW20,
    jobType: BULL_JOB_NAME.ENRICH_CW20,
    prefix: 'horoscope_',
  })
  async jobHandlerEnrichCw20(_payload: {
    address: string;
    codeId: string;
    txData: {
      txhash: string;
      sender: string;
      action: string;
    };
  }): Promise<void> {
    console.log('aaaa');
  }

  @Action({
    name: 'enrichCw20',
  })
  async enrichCw721(
    ctx: Context<{
      address: string;
      codeId: string;
      txData: {
        txhash: string;
        sender: string;
        action: string;
      };
    }>
  ) {
    this.createJob(BULL_JOB_NAME.ENRICH_CW20, BULL_JOB_NAME.ENRICH_CW20, {
      address: ctx.params.address,
      codeId: ctx.params.codeId,
      txData: ctx.params.txData,
    });
  }

  async _getOwnerList(address: string): Promise<string[]> {
    try {
      let doneLoop = false;
      const listOwnerAddress: string[] = [];
      let queryData: string = toBase64(
        toUtf8('{"all_accounts": {"limit":100}}')
      );
      while (!doneLoop) {
        const resultCallApi =
          // eslint-disable-next-line no-await-in-loop
          await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.smartContractState({
            address,
            queryData,
          });
        if (
          resultCallApi != null &&
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          resultCallApi?.data?.accounts?.length > 0
        ) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          listOwnerAddress.push(...resultCallApi.data.accounts);

          const lastAddress =
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            resultCallApi.data.accounts[resultCallApi.data.accounts.length - 1];

          queryData = toBase64(
            toUtf8(
              `{"all_accounts": {"limit":100, "start_after":"${lastAddress}"}}`
            )
          );
        } else {
          doneLoop = true;
        }
      }
      return listOwnerAddress;
    } catch (error) {
      throw new Error(`getOwnerList error ${error}`);
    }
  }

  async _getBalances(address: string, owners: string[]): Promise<CW20Holder[]> {
    try {
      const result: CW20Holder[] = [];
      const listPromise: any[] = [];
      owners.forEach((owner) => {
        const str = `{"balance":{"address": "${owner}"}}`;
        const queryData = toBase64(toUtf8(str));
        listPromise.push(
          this._httpBatchClient.execute(
            createJsonRpcRequest('abci_query', {
              path: '/cosmwasm.wasm.v1.Query/SmartContractState',
              data: toHex(
                cosmwasm.wasm.v1.QuerySmartContractStateRequest.encode({
                  address,
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  queryData,
                }).finish()
              ),
            })
          )
        );
      });
      const resultListPromise: JsonRpcSuccessResponse[] = await Promise.all(
        listPromise
      );
      owners.forEach((owner, index) => {
        result.push(
          CW20Holder.fromJson({
            address: owner,
            balance: JSON.parse(
              fromUtf8(
                fromBase64(resultListPromise[index].result.response.value)
              ).substring(2)
            ).balance,
            contract_address: address,
          })
        );
      });
      return result;
    } catch (error) {
      throw new Error(`getBalances error ${error}`);
    }
  }

  // confirmed
  async _getMarketingInfo(address: string): Promise<ICW20MarketingInfo> {
    try {
      const queryData = toBase64(toUtf8('{"marketing_info": {}}'));
      const marketingInfo: ICW20MarketingInfo =
        await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.smartContractState({
          address,
          queryData,
        });
      return marketingInfo;
    } catch (error) {
      throw new Error(`getMarketInfo error ${error}`);
    }
  }

  // confirmed
  async _getAssetInfo(address: string): Promise<ICW20AssetInfo> {
    try {
      const queryData = toBase64(toUtf8('{"token_info": {}}'));
      const assetInfo: ICW20AssetInfo =
        await this._lcdClient.cosmwasm.cosmwasm.wasm.v1.smartContractState({
          address,
          queryData,
        });
      return assetInfo;
    } catch (error) {
      throw new Error(`get AssetInfo error ${error}`);
    }
  }

  public async _start(): Promise<void> {
    this._lcdClient = await getLcdClient();
    console.log(
      await this._getMarketingInfo(
        'aura1lu25zlvun87gkmnufv5ra7v0wmzms5eskkvv8d07qj4xydjsd02qy98gqv'
      )
    );

    return super._start();
  }
}

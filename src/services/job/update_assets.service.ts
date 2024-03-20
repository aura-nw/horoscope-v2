import { fromBase64, toHex } from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { cosmos, ibc } from '@horoscope/sei-js-proto';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import Long from 'long';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  SERVICE,
  getHttpBatchClient,
  getLcdClient,
} from '../../common';
import { Cw20Contract } from '../../models';
import { Asset } from '../../models/asset';
import { Erc20Contract } from '../../models/erc20_contract';

@Service({
  name: SERVICE.V1.JobService.UpdateAssets.key,
  version: 1,
})
export default class UpdateAssetsJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_UPDATE_ASSETS,
    jobName: BULL_JOB_NAME.JOB_UPDATE_ASSETS,
  })
  async jobUpdateAssets() {
    const coinAssets = await this.queryRpcAssets();
    const originAssets = await this.queryRpcOriginAssets(coinAssets);
    const cw20Assets = await Cw20Contract.query()
      .joinRelated('smart_contract')
      .select(
        'smart_contract.address',
        'cw20_contract.total_supply',
        'cw20_contract.id as cw20_contract_id',
        'cw20_contract.decimal',
        'cw20_contract.name'
      );
    const erc20Assets = await Erc20Contract.query();
    const assets: Asset[] = [];
    assets.push(
      ...originAssets.map((originAsset) => {
        let type = null;
        if (originAsset.denom.startsWith(Asset.PREFIX.IBC)) {
          type = Asset.TYPE.IBC_TOKEN;
        } else if (originAsset.denom.startsWith(Asset.PREFIX.FACTORY)) {
          type = Asset.TYPE.FACTORY_TOKEN;
        } else {
          type = Asset.TYPE.NATIVE;
        }
        return Asset.fromJson({
          denom: originAsset.denom,
          type,
          total_supply: originAsset.amount,
          updated_at: new Date().toISOString(),
          origin_id: originAsset.origin,
        });
      }),
      ...cw20Assets.map((cw20Asset) =>
        Asset.fromJson({
          denom: cw20Asset.address,
          type: Asset.TYPE.CW20_TOKEN,
          decimal: cw20Asset.decimal,
          name: cw20Asset.name,
          total_supply: cw20Asset.total_supply,
          origin_id: cw20Asset.cw20_contract_id,
          updated_at: new Date().toISOString(),
        })
      ),
      ...erc20Assets.map((erc20Asset) =>
        Asset.fromJson({
          denom: erc20Asset.address,
          type: Asset.TYPE.ERC20_TOKEN,
          decimal: erc20Asset.decimals,
          name: erc20Asset.name,
          total_supply: erc20Asset.total_supply,
          origin_id: erc20Asset.evm_smart_contract_id,
          updated_at: new Date().toISOString(),
        })
      )
    );
    if (assets.length > 0) {
      await Asset.query().insert(assets).onConflict('denom').merge();
    }
  }

  async queryRpcAssets() {
    const lcdClient = await getLcdClient();
    const assets: any[] = [];
    const countTotal = parseInt(
      (
        await lcdClient.cosmos.cosmos.bank.v1beta1.totalSupply({
          pagination: {
            count_total: true,
          },
        })
      ).pagination.total,
      10
    );
    const httpBatchClient = getHttpBatchClient();
    const batchQueries: any = [];
    for (
      let index = 0;
      index < Math.ceil(countTotal / config.jobUpdateAssets.lcdRecordGet);
      index += 1
    ) {
      batchQueries.push(
        httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: '/cosmos.bank.v1beta1.Query/TotalSupply',
            data: toHex(
              cosmos.bank.v1beta1.QueryTotalSupplyRequest.encode({
                pagination: {
                  key: new Uint8Array(),
                  limit: Long.fromInt(config.jobUpdateAssets.lcdRecordGet),
                  offset: Long.fromInt(
                    index * config.jobUpdateAssets.lcdRecordGet
                  ),
                  countTotal: false,
                  reverse: false,
                },
              }).finish()
            ),
          })
        )
      );
    }
    const resultTotalSupply: JsonRpcSuccessResponse[] = await Promise.all(
      batchQueries
    );
    resultTotalSupply.forEach((res) => {
      assets.push(
        ...cosmos.bank.v1beta1.QueryTotalSupplyResponse.decode(
          fromBase64(res.result.response.value)
        ).supply
      );
    });
    const coinAssetsKeyByDenom = _.keyBy(assets, 'denom');
    const missingDenomAssets = (
      await Asset.query()
        .whereIn('type', [
          Asset.TYPE.IBC_TOKEN,
          Asset.TYPE.FACTORY_TOKEN,
          Asset.TYPE.NATIVE,
        ])
        .andWhereNot('total_supply', '0')
    ).filter((asset) => !coinAssetsKeyByDenom[asset.denom]);
    // query missing assets by denom
    const resultSupplyOf: JsonRpcSuccessResponse[] =
      await this.queryRpcMissingAssetByDenom(
        missingDenomAssets.map((e) => e.denom),
        httpBatchClient
      );
    resultSupplyOf.forEach((res) => {
      assets.push(
        cosmos.bank.v1beta1.QuerySupplyOfResponse.decode(
          fromBase64(res.result.response.value)
        ).amount
      );
    });
    return assets;
  }

  // Query missing assets by denom
  async queryRpcMissingAssetByDenom(
    denoms: string[],
    httpBatchClient: HttpBatchClient
  ) {
    const batchQueries: any = denoms.map((denom) =>
      httpBatchClient.execute(
        createJsonRpcRequest('abci_query', {
          path: '/cosmos.bank.v1beta1.Query/SupplyOf',
          data: toHex(
            cosmos.bank.v1beta1.QuerySupplyOfRequest.encode({
              denom,
            }).finish()
          ),
        })
      )
    );
    return Promise.all(batchQueries);
  }

  async queryRpcOriginAssets(
    coinAssets: {
      denom: string;
      amount: string;
      origin: string | undefined;
    }[]
  ) {
    const httpBatchClient = getHttpBatchClient();
    const batchQueries: any = [];
    coinAssets.forEach((coinAsset) => {
      batchQueries.push(
        httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.DENOM_TRACE,
            data: toHex(
              ibc.applications.transfer.v1.QueryDenomTraceRequest.encode({
                hash: coinAsset.denom.substring(4),
              }).finish()
            ),
          })
        )
      );
    });
    const resultIbcDenom: JsonRpcSuccessResponse[] = await Promise.all(
      batchQueries
    );
    resultIbcDenom.forEach((res, index) => {
      let origin;
      if (res.result.response.value) {
        const path =
          ibc.applications.transfer.v1.QueryDenomTraceResponse.decode(
            fromBase64(res.result.response.value)
          ).denomTrace?.path;
        origin = path?.split('/')[1];
      }
      // eslint-disable-next-line no-param-reassign
      coinAssets[index].origin = origin;
    });
    return coinAssets;
  }

  public async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.JOB_UPDATE_ASSETS,
      BULL_JOB_NAME.JOB_UPDATE_ASSETS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobUpdateAssets.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}

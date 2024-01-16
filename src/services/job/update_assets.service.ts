import { fromBase64, toHex } from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { cosmos, ibc } from '@horoscope-v2/sei-js-proto';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import Long from 'long';
import { ServiceBroker } from 'moleculer';
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
    const assets: Asset[] = [];
    assets.push(
      ...originAssets.map((originAsset) =>
        Asset.fromJson({
          denom: originAsset.denom,
          type: !originAsset.denom.startsWith('ibc/')
            ? Asset.TYPE.NATIVE
            : Asset.TYPE.IBC_TOKEN,
          total_supply: originAsset.amount,
          updated_at: new Date().toISOString(),
          origin_id: originAsset.origin,
        })
      ),
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
    return assets;
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

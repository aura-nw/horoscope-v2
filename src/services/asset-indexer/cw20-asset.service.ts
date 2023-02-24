import { toBase64, toUtf8 } from '@cosmjs/encoding';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { CallingOptions, Context } from 'moleculer';
import BullableService, { QueueHandler } from 'src/base/BullableService';
import { Config } from 'src/common';
import { CW20_ACTION } from 'src/common/constant';
import CallApiMixin from 'src/common/mixins/callApi/call-api.mixin';
import { CW20Holder, ICW20Holder } from 'src/models/CW20_Holder.model';
import { CW20Token, ICW20Token } from 'src/models/CW20_Token.model';
import { CW20Tx, ICW20Tx } from 'src/models/CW20_Tx.model';
import { ITokenInfo } from './common.service';

export interface ICW20MarketingInfo {
  data: {
    project: string;
    description: string;
    logo: {
      url: string;
    };
    marketing: string;
  };
}
export interface ICW20BalanceInfo {
  data: {
    balance: string;
  };
}

export interface ICW20AssetInfo {
  data: {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
  };
}
const opts: CallingOptions = {
  timeout: Config.ASSET_INDEXER_ACTION_TIMEOUT,
  retries: Config.ASSET_INDEXER_MAX_RETRY_REQ,
};
const { CONTRACT_URI } = Config;
interface Payload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  url: any;
  address: string;
  codeId: string;
  txhash: string;
}

@Service({
  name: 'CW20',
  version: 1,
  mixins: [new CallApiMixin().start()],
})
export default class CrawlAssetService extends BullableService {
  @Action({ name: 'getOwnerList' })
  private async _getOwnerList(ctx: Context<ITokenInfo>) {
    const { url } = ctx.params;
    const { address } = ctx.params;
    try {
      let doneLoop = false;
      const listOwnerAddress: string[] = [];
      let urlGetListToken = `${CONTRACT_URI}${address}/smart/${toBase64(
        toUtf8('{"all_accounts": {"limit":100}}')
      )}`;

      while (!doneLoop) {
        this.logger.debug('param call lcd: ', JSON.stringify(urlGetListToken));
        const resultCallApi: { data: { accounts: string[] } } | null =
          // eslint-disable-next-line no-await-in-loop
          await this.callApiFromDomain(url, urlGetListToken);
        if (
          resultCallApi != null &&
          resultCallApi?.data?.accounts?.length > 0
        ) {
          listOwnerAddress.push(...resultCallApi.data.accounts);
          const lastAddress =
            resultCallApi.data.accounts[resultCallApi.data.accounts.length - 1];

          urlGetListToken = `${CONTRACT_URI}${address}/smart/${toBase64(
            toUtf8(
              `{"all_accounts": {"limit":100, "start_after":"${lastAddress}"}}`
            )
          )}`;
        } else {
          doneLoop = true;
        }
      }
      this.logger.debug('url: ', JSON.stringify(url));
      this.logger.debug('address: ', address);
      this.logger.debug('listOwner: ', JSON.stringify(listOwnerAddress));
      if (listOwnerAddress.length > 0) {
        return listOwnerAddress;
      }
      return null;
    } catch (error) {
      this.logger.error('getOwnerList error', error);
    }
    return null;
  }

  @Action({ name: 'getBalance' })
  private async _getBalance(
    ctx: Context<ITokenInfo>
  ): Promise<ICW20BalanceInfo | null> {
    const { url } = ctx.params;
    try {
      const str = `{"balance":{"address": "${ctx.params.owner}"}}`;
      const stringEncode64bytes = Buffer.from(str).toString('base64');
      const urlGetBalance = `${CONTRACT_URI}${ctx.params.address}/smart/${stringEncode64bytes}`;
      this.logger.debug('path get balance: ', urlGetBalance);
      const balanceInfo: ICW20BalanceInfo | null = await this.callApiFromDomain(
        url,
        urlGetBalance
      );
      return balanceInfo;
    } catch (error) {
      this.logger.error('getBalance error', error);
    }
    return null;
  }

  @Action({ name: 'getMarketingInfo' })
  private async _getMarketingInfo(
    ctx: Context<ITokenInfo>
  ): Promise<ICW20MarketingInfo | null> {
    const { url } = ctx.params;
    const { address } = ctx.params;
    try {
      const urlGetMarketInfo = `${CONTRACT_URI}${address}/smart/${CW20_ACTION.URL_GET_MARKETING_INFO}`;
      this.logger.debug('path get market info: ', urlGetMarketInfo);
      const marketingInfo: ICW20MarketingInfo | null =
        await this.callApiFromDomain(url, urlGetMarketInfo);
      return marketingInfo;
    } catch (error) {
      this.logger.error('getMarketInfo error', error);
    }
    return null;
  }

  @QueueHandler({
    queueName: 'CW20',
    jobType: 'enrich',
  })
  private async jobHandler(_payload: Payload): Promise<void> {
    const { url, address, codeId, txhash } = _payload;
    await this.handleJobEnrichData(url, address, codeId, txhash);
  }

  private async handleJobEnrichData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    url: any,
    address: string,
    codeId: string,
    txhash: string
  ) {
    const urlGetTokenInfo = `${CONTRACT_URI}${address}/smart/${CW20_ACTION.URL_GET_TOKEN_INFO}`;
    const tokenInfo: ICW20AssetInfo | null = await this.callApiFromDomain(
      url,
      urlGetTokenInfo
    );

    const listOwnerAddress: string[] = await this.broker.call(
      CW20_ACTION.GET_OWNER_LIST,
      { url, codeId, address },
      opts
    );

    const marketInfo: ICW20MarketingInfo | null = await this.broker.call(
      CW20_ACTION.GET_MARKET_INFO,
      { url, address },
      opts
    );
    if (marketInfo === null) {
      throw new Error('CW20 enrich MarketInfo not found');
    } else if (tokenInfo === null) {
      throw new Error('CW20 enrich TokenInfo not found');
    } else if (listOwnerAddress === null) {
      throw new Error('CW20 fail to fetch list owner');
    } else {
      const cw20Token = {
        code_id: codeId,
        asset_info: tokenInfo,
        contract_address: address,
        marketing_info: marketInfo,
      };
      await this.upsertToken(cw20Token);
      await this.insertTx(cw20Token, txhash);
      await Promise.all(
        listOwnerAddress.map(async (owner: string) => {
          const balanceInfo: ICW20BalanceInfo | null = await this.broker.call(
            CW20_ACTION.GET_BALANCE,
            { url, codeId, address, owner },
            opts
          );
          if (balanceInfo != null) {
            this.insertHolder({
              address: owner,
              balance: balanceInfo.data.balance,
              cw20_token: address,
            });
          } else {
            throw new Error(`Fail to fetch ${owner}'s balance info`);
          }
        })
      );
    }
  }

  private async insertHolder(holder: ICW20Holder) {
    await CW20Holder.query().insert(holder);
  }

  private async upsertToken(cw20Token: ICW20Token): Promise<string> {
    const item = await CW20Token.query().findOne({
      contract_address: cw20Token.contract_address,
    });
    // eslint-disable-next-line camelcase
    if (item) {
      await item.$query().update(cw20Token);
    } else {
      await CW20Token.query().insert(cw20Token);
    }
    // eslint-disable-next-line no-underscore-dangle
    return cw20Token.contract_address;
  }

  private async insertTx(item: ICW20Token, txhash: string) {
    if (item.contract_address) {
      const cw20Tx: ICW20Tx = {
        tx_hash: txhash,
        cw20_token: item.contract_address,
      };
      await CW20Tx.query().insert(cw20Tx);
    } else {
      throw new Error('Upsert CW20 Tx fail');
    }
  }
}

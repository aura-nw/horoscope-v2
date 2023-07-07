/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { parseCoins } from '@cosmjs/proto-signing';
import BigNumber from 'bignumber.js';
import {
  AccountStatistics,
  Event,
  EventAttribute,
  Transaction,
} from '../../models';
import {
  BULL_JOB_NAME,
  IAccountStatsParam,
  ICreateSpecificDateJob,
  REDIS_KEY,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import Utils from '../../common/utils/utils';

@Service({
  name: SERVICE.V1.AccountStatisticsService.key,
  version: 1,
})
export default class AccountStatisticsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.AccountStatisticsService.CreateSpecificDateJob.key,
    params: {
      date: 'string',
    },
  })
  public async actionCreateSpecificDateJob(
    ctx: Context<ICreateSpecificDateJob>
  ) {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
      BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
      {
        id: null,
        date: ctx.params.date,
        accountStats: [],
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
    jobName: BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: IAccountStatsParam): Promise<void> {
    try {
      const { accountStats } = _payload;

      const syncDate = new Date(_payload.date);
      const endTime = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 1);
      const startTime = syncDate.setUTCHours(0, 0, 0, 0);

      const startTxId = !_payload.id
        ? (
            await Transaction.query()
              .select('id')
              .where('transaction.timestamp', '>=', new Date(startTime))
              .limit(1)
              .orderBy('id')
          )[0].id
        : _payload.id;
      const nextId = startTxId + 50;
      this.logger.info(
        `Get account statistic events from id ${startTxId} for day ${new Date(
          startTime
        )}`
      );

      const dailyEvents = await Transaction.query()
        .joinRelated('events.[attributes]')
        .select(
          'transaction.gas_used',
          'events:attributes.event_id',
          'events:attributes.composite_key',
          'events:attributes.value'
        )
        .where('transaction.timestamp', '>=', new Date(startTime))
        .andWhere('transaction.timestamp', '<', new Date(endTime))
        .andWhere('transaction.id', '>=', startTxId)
        .andWhere('transaction.id', '<', nextId)
        .andWhere((builder) =>
          builder
            .whereIn('events.type', [
              Event.EVENT_TYPE.COIN_SPENT,
              Event.EVENT_TYPE.COIN_RECEIVED,
              Event.EVENT_TYPE.USE_FEEGRANT,
            ])
            .orWhereIn('events:attributes.key', [
              EventAttribute.ATTRIBUTE_KEY.FEE,
              EventAttribute.ATTRIBUTE_KEY.FEE_PAYER,
            ])
        );

      if (dailyEvents.length > 0) {
        dailyEvents
          .filter(
            (event) =>
              Utils.isValidAccountAddress(
                event.value,
                config.networkPrefixAddress,
                20
              ) ||
              Utils.isValidAccountAddress(
                event.value,
                config.networkPrefixAddress,
                32
              )
          )
          .forEach((event) => {
            if (!accountStats.find((acc) => acc.address === event.value)) {
              accountStats.push({
                address: event.value,
                amount_sent: '0',
                amount_received: '0',
                tx_sent: 0,
                gas_used: '0',
              });
            }
          });

        dailyEvents
          .filter(
            (event) =>
              !Utils.isValidAccountAddress(
                event.value,
                config.networkPrefixAddress,
                20
              )
          )
          .forEach((event) => {
            switch (event.composite_key) {
              case EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_AMOUNT:
                const addrSpent = dailyEvents.find(
                  (dEvent) =>
                    dEvent.event_id === event.event_id &&
                    dEvent.composite_key ===
                      EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_SPENDER
                )?.value;

                const indexSpent = accountStats.indexOf(
                  accountStats.find((acc) => acc.address === addrSpent)!
                );

                accountStats[indexSpent].amount_sent = (
                  BigInt(accountStats[indexSpent].amount_sent) +
                  BigInt(parseCoins(event.value)[0].amount)
                ).toString();
                break;
              case EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_AMOUNT:
                const addrReceived = dailyEvents.find(
                  (dEvent) =>
                    dEvent.event_id === event.event_id &&
                    dEvent.composite_key ===
                      EventAttribute.ATTRIBUTE_COMPOSITE_KEY
                        .COIN_RECEIVED_RECEIVER
                )?.value;

                const indexReceived = accountStats.indexOf(
                  accountStats.find((acc) => acc.address === addrReceived)!
                );

                accountStats[indexReceived].amount_received = (
                  BigInt(accountStats[indexReceived].amount_received) +
                  BigInt(parseCoins(event.value)[0].amount)
                ).toString();
                break;
              default:
                break;
            }
          });

        dailyEvents
          .filter(
            (event) =>
              event.composite_key ===
              EventAttribute.ATTRIBUTE_COMPOSITE_KEY.TX_FEE_PAYER
          )
          .forEach((event) => {
            let addr = event.value;

            const feeGrant = dailyEvents.find(
              (dEvent) =>
                dEvent.event_id === event.event_id &&
                dEvent.composite_key ===
                  EventAttribute.ATTRIBUTE_COMPOSITE_KEY.USE_FEEGRANT_GRANTEE
            );

            if (feeGrant) {
              addr = feeGrant.value;
            }

            const index = accountStats.indexOf(
              accountStats.find((acc) => acc.address === addr)!
            );
            accountStats[index].tx_sent += 1;
            accountStats[index].gas_used = (
              BigInt(accountStats[index].gas_used) + BigInt(event.gas_used)
            ).toString();
          });

        await this.createJob(
          BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
          BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
          {
            id: nextId,
            date: _payload.date,
            accountStats,
          },
          {
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        );
      } else {
        const dailyAccountStats = accountStats.map((acc) =>
          AccountStatistics.fromJson({
            ...acc,
            date: new Date(startTime).toISOString(),
          })
        );

        this.logger.info(
          `Insert new daily statistic for date ${new Date(startTime)}`
        );
        if (dailyAccountStats.length > 0) {
          await AccountStatistics.query()
            .insert(dailyAccountStats)
            .catch((error) => {
              this.logger.error(
                'Error insert new daily account statistic records'
              );
              this.logger.error(error);
            });
        }

        await this.createJob(
          BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
          BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
          {},
          {
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        );
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
    jobName: BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleTopAccounts(_payload: object): Promise<void> {
    try {
      const syncDate = new Date();
      const now = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 3);
      const threeDays = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 15);
      const fifteenDays = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 30);
      const thirtyDays = syncDate.setUTCHours(0, 0, 0, 0);

      const [threeDayStat, fifteenDayStat, thirtyDayStat] = await Promise.all([
        AccountStatistics.query()
          .select('address')
          .sum('amount_sent as amount_sent')
          .sum('amount_received as amount_received')
          .sum('tx_sent as tx_sent')
          .sum('gas_used as gas_used')
          .where('date', '>=', new Date(threeDays))
          .andWhere('date', '<', new Date(now))
          .groupBy('address'),
        AccountStatistics.query()
          .select('address')
          .sum('amount_sent as amount_sent')
          .sum('amount_received as amount_received')
          .sum('tx_sent as tx_sent')
          .sum('gas_used as gas_used')
          .where('date', '>=', new Date(fifteenDays))
          .andWhere('date', '<', new Date(now))
          .groupBy('address'),
        AccountStatistics.query()
          .select('address')
          .sum('amount_sent as amount_sent')
          .sum('amount_received as amount_received')
          .sum('tx_sent as tx_sent')
          .sum('gas_used as gas_used')
          .where('date', '>=', new Date(thirtyDays))
          .andWhere('date', '<', new Date(now))
          .groupBy('address'),
      ]);

      let topAccounts = await this.broker.cacher?.get(REDIS_KEY.TOP_ACCOUNTS);
      topAccounts = {
        three_days: this.calculateTop(threeDayStat),
        fifteen_days: this.calculateTop(fifteenDayStat),
        thirty_days: this.calculateTop(thirtyDayStat),
      };

      this.logger.info(`Update top accounts for day ${new Date(now)}`);
      await this.broker.cacher?.set(REDIS_KEY.TOP_ACCOUNTS, topAccounts);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private calculateTop(dayStat: AccountStatistics[]) {
    const newTopStat = {
      top_amount_sent: [] as any[],
      top_amount_received: [] as any[],
      top_tx_sent: [] as any[],
      top_gas_used: [] as any[],
    };

    const dayStatAmountSent = dayStat
      .map((statistic) => statistic.amount_sent)
      .reduce((a: string, b: string) => (BigInt(a) + BigInt(b)).toString());
    const dayStatAmountReceived = dayStat
      .map((statistic) => statistic.amount_received)
      .reduce((a: string, b: string) => (BigInt(a) + BigInt(b)).toString());
    const dayStatTxSent = dayStat
      .map((statistic) => statistic.tx_sent)
      .reduce((a: number, b: number) => Number(BigInt(a) + BigInt(b)));
    const dayStatGasUsed = dayStat
      .map((statistic) => statistic.gas_used)
      .reduce((a: string, b: string) => (BigInt(a) + BigInt(b)).toString());

    dayStat.forEach((stat) => {
      newTopStat.top_amount_sent.push({
        address: stat.address,
        amount: stat.amount_sent,
        percentage: Number(
          BigNumber(stat.amount_sent)
            .multipliedBy(100)
            .dividedBy(BigNumber(dayStatAmountSent))
        ),
      });
      newTopStat.top_amount_received.push({
        address: stat.address,
        amount: stat.amount_received,
        percentage: Number(
          BigNumber(stat.amount_received)
            .multipliedBy(100)
            .dividedBy(BigNumber(dayStatAmountReceived))
        ),
      });
      newTopStat.top_tx_sent.push({
        address: stat.address,
        amount: stat.tx_sent,
        percentage: (stat.tx_sent * 100) / dayStatTxSent,
      });
      newTopStat.top_gas_used.push({
        address: stat.address,
        amount: stat.gas_used,
        percentage: Number(
          BigNumber(stat.gas_used)
            .multipliedBy(100)
            .dividedBy(BigNumber(dayStatGasUsed))
        ),
      });
    });
    newTopStat.top_amount_sent = newTopStat.top_amount_sent
      .sort((a, b) => b.percentage - a.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );
    newTopStat.top_amount_received = newTopStat.top_amount_received
      .sort((a, b) => b.percentage - a.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );
    newTopStat.top_tx_sent = newTopStat.top_tx_sent
      .sort((a, b) => b.percentage - a.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );
    newTopStat.top_gas_used = newTopStat.top_gas_used
      .sort((a, b) => b.percentage - a.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );

    return newTopStat;
  }

  public async _start() {
    return super._start();
  }
}

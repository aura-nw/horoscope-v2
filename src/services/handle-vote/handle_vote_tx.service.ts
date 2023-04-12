import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  Event,
  Attribute,
  logs,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { coins, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { cosmos } from '@aura-nw/aurajs';
import { Checkpoint, Transaction, Vote } from '../../models';
import { BULL_JOB_NAME, SERVICE_NAME } from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE_NAME.HANDLE_VOTE_TX,
  version: 1,
})
export default class HandleTxVote extends BullableService {
  private _currentTxId = 0;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_VOTE_TX,
    jobType: BULL_JOB_NAME.HANDLE_VOTE_TX,
  })
  private async jobHandle(_payload: any): Promise<void> {
    await this.initEnv();
    await this.handleTx();
  }

  async initEnv() {
    const checkpoint = (
      await Checkpoint.query().findOne({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
      })
    )?.data.tx_id;
    if (checkpoint == null) {
      await Checkpoint.query().insert({
        job_name: BULL_JOB_NAME.HANDLE_VOTE_TX,
        data: {
          tx_id: config.handleVoteTx.startTxId,
        },
      });
    }
    this._currentTxId = checkpoint ?? 0;
  }

  async handleTx() {
    // const sql = Transaction.query()
    //   .joinRelated('events.[attributes]')
    //   // .withGraphFetched(TransactionEventAttribute)
    //   // .where('transaction.id', '>=', this._currentTxId)
    //   .where('events.type', 'proposal_vote')
    //   .orderBy('transaction.id')
    //   .limit(config.handleVoteTx.numberOfTxPerCall)
    //   .toKnexQuery()
    //   .toSQL()
    //   .toNative();
    // this.logger.info(sql);
    const listTx = await Transaction.query()
      .joinRelated('events')
      // .withGraphFetched(TransactionEventAttribute)
      .where('transaction.id', '>=', this._currentTxId)
      .andWhere('events.type', 'proposal_vote')
      .andWhere('transaction.code', 0)
      .orderBy('transaction.id')
      .groupBy('transaction.id')
      .limit(config.handleVoteTx.numberOfTxPerCall)
      .select(
        'transaction.data',
        'transaction.id',
        'transaction.height',
        'transaction.hash'
      );
    this.logger.info(listTx.length);
    const listVoteInsert = [];

    listTx.forEach((tx: Transaction) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { logs } = tx.data.tx_response;
      // const { height, id, hash } = tx;
      logs.forEach((log: logs.Log) => {
        let proposalId;
        let option;
        log.events.forEach((event: Event) => {
          let map: Map<number, object>;
          if (event.type === 'message') {
            const index = 0;
            event.attributes.forEach((attribute: Attribute) => {
              let obj = map.get(index);
              if (obj) {
                obj[attribute.key] = attribute.value;
              } else {
                obj = {};
                obj[attribute.key] = attribute.value;
              }
              map.set(index, obj);
            });
          } else if (event.type === 'proposal_vote') {
            event.attributes.forEach((attribute: Attribute) => {
              if (attribute.key === 'option') {
                option = attribute.value;
              } else if (attribute.key === 'proposal_id') {
                proposalId = attribute.value;
              }
            });
          }
        });
        this.logger.info(`Vote proposal_id ${proposalId}, option ${option}`);
        listVoteInsert.push(Vote.fromJson({}));
      });
    });

    // this.logger.info(JSON.stringify(listTx));
  }

  async testVote() {
    const account1 = {
      address: 'aura17dv9s7hujzkruzmezeg4l39zfuks7mjfscddcm',
      mnemonic:
        'sting erupt teach roof dentist eagle found garment spatial panther slice hold despair feed service avocado enemy pigeon tone craft off radar special purity',
    };
    // const account2 = {
    //   address: 'aura1efn8qnrafpaj8hm9yp5pvs9xmtw36exvgv4vaf',
    //   mnemonic:
    //     'decrease kitten defy stereo frog cook ticket kid royal space usage tuition call expire transfer uphold trial antenna arm chief melody human strategy armor',
    // };

    const account3 = {
      address: 'aura1w9t69ct8wpafl0qt786wuqa38hrhfth8dskav6',
      mnemonic:
        'vanish biology kitchen entire general nothing snap purse ask mean net like legal elephant already transfer become empty cover future warrior vicious music trophy',
    };
    const client = await SigningStargateClient.connectWithSigner(
      'https://rpc.dev.aura.network/',
      await DirectSecp256k1HdWallet.fromMnemonic(account1.mnemonic, {
        prefix: 'aura',
      })
    );
    // const client2 = await SigningStargateClient.connectWithSigner(
    //   'https://rpc.dev.aura.network/',
    //   await DirectSecp256k1HdWallet.fromMnemonic(account2.mnemonic, {
    //     prefix: 'aura',
    //   })
    // );

    const result = await client.signAndBroadcast(
      account1.address,
      [
        {
          typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
          value: {
            granter: account1.address,
            grantee: account3.address,
            grant: {
              authorization: {
                typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
                value: cosmos.authz.v1beta1.GenericAuthorization.encode(
                  cosmos.authz.v1beta1.GenericAuthorization.fromPartial({
                    msg: '/cosmos.gov.v1beta1.MsgVote',
                  })
                ).finish(),
              },
            },
          },
        },
      ],
      {
        amount: coins(25000, 'utaura'),
        gas: '1500000',
      },
      'test grant vote'
    );

    this.logger.info(result);

    // const result2 = await client2.signAndBroadcast(
    //   account2.address,
    //   [
    //     {
    //       typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    //       value: {
    //         granter: account2.address,
    //         grantee: account3.address,
    //         grant: {
    //           authorization: {
    //             typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
    //             value: cosmos.authz.v1beta1.GenericAuthorization.encode(
    //               cosmos.authz.v1beta1.GenericAuthorization.fromPartial({
    //                 msg: '/cosmos.authz.v1beta1.MsgExec',
    //               })
    //             ).finish(),
    //           },
    //         },
    //       },
    //     },
    //   ],
    //   {
    //     amount: coins(25000, 'utaura'),
    //     gas: '1500000',
    //   },
    //   'test grant vote'
    // );
    // this.logger.info(result2);
  }

  async testExec() {
    const account1 = {
      address: 'aura17dv9s7hujzkruzmezeg4l39zfuks7mjfscddcm',
      mnemonic:
        'sting erupt teach roof dentist eagle found garment spatial panther slice hold despair feed service avocado enemy pigeon tone craft off radar special purity',
    };
    const account2 = {
      address: 'aura1efn8qnrafpaj8hm9yp5pvs9xmtw36exvgv4vaf',
      mnemonic:
        'decrease kitten defy stereo frog cook ticket kid royal space usage tuition call expire transfer uphold trial antenna arm chief melody human strategy armor',
    };
    const account3 = {
      address: 'aura1w9t69ct8wpafl0qt786wuqa38hrhfth8dskav6',
      mnemonic:
        'vanish biology kitchen entire general nothing snap purse ask mean net like legal elephant already transfer become empty cover future warrior vicious music trophy',
    };

    const client3 = await SigningStargateClient.connectWithSigner(
      'https://rpc.dev.aura.network/',
      await DirectSecp256k1HdWallet.fromMnemonic(account3.mnemonic, {
        prefix: 'aura',
      })
    );

    const result = await client3.signAndBroadcast(
      account3.address,
      [
        {
          typeUrl: '/cosmos.authz.v1beta1.MsgExec',
          value: {
            grantee: account3.address,
            msgs: [
              {
                typeUrl: '/cosmos.authz.v1beta1.MsgExec',
                value: cosmos.authz.v1beta1.MsgExec.encode(
                  cosmos.authz.v1beta1.MsgExec.fromPartial({
                    grantee: account2.address,
                    msgs: [
                      {
                        typeUrl: '/cosmos.gov.v1beta1.MsgVote',
                        value: cosmos.gov.v1beta1.MsgVote.encode(
                          cosmos.gov.v1beta1.MsgVote.fromPartial({
                            option: 1,
                            proposalId: '414',
                            voter: account1.address,
                          })
                        ).finish(),
                      },
                    ],
                  })
                ).finish(),
              },
            ],
          },
        },
      ],
      {
        amount: coins(25000, 'utaura'),
        gas: '1500000',
      },
      'test exec vote'
    );

    this.logger.info(result);
  }

  public async _start(): Promise<void> {
    // await this.testVote();
    await this.testExec();
    // this.createJob(
    //   BULL_JOB_NAME.HANDLE_VOTE_TX,
    //   BULL_JOB_NAME.HANDLE_VOTE_TX,
    //   {},
    //   {
    //     removeOnComplete: true,
    //     removeOnFail: {
    //       count: 3,
    //     },
    //     repeat: {
    //       every: config.handleVoteTx.millisecondCrawl,
    //     },
    //   }
    // );
    return super._start();
  }
}

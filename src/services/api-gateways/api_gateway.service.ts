/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * API Gateway class
 * Just receive request from client, parse param and forward to coresponding bussiness Service(s)
 * PLEASE DONT PUT BUSINESS LOGIC HERE
 *  to list : curl localhost:3000/api/ApiService/list-aliases | jq '.[] | select(.actionName| contains("PersonService.sayWelcome"))'
 */

import ApiGateway from 'moleculer-web';
import { ServiceBroker } from 'moleculer';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';

import BaseService from '../../base/base.service';
import { bullBoardMixin } from '../../mixins/bullBoard/bullBoard.mixin';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  mixins: [ApiGateway, bullBoardMixin()],
  settings: {
    routes: [
      {
        path: '/api',
        autoAliases: true, // allow generate rest info (GET/PUT/POST...) in the services
        mappingPolicy: 'restrict', // allow action called with exact method
        whitelist: [
          'v2.graphql.*',
          'v2.statistics.getDashboardStatisticsByChainId',
          'v2.statistics.getTopAccountsByChainId',
          'v2.services-manager.*',
          'v2.evm-proxy.*',
        ],
      },
      {
        path: '/admin',
        autoAliases: true, // allow generate rest info (GET/PUT/POST...) in the services
        mappingPolicy: 'restrict', // allow action called with exact method
        whitelist: [
          'v1.cw20-admin.*',
          'v1.cw721-admin.*',
          'v2.statistics.syncPrevDateStatsByChainId',
          'v1.job.composite-index-to-attribute-partition',
          'v1.job.redecode-tx',
          'v1.job.update-delegator-validator',
          'v1.job.signature-mapping',
        ],
      },
      {
        path: '/auth',
        autoAliases: true,
        mappingPolicy: 'restrict',
        whitelist: ['v1.horoscope-handler.getDataByChainId'],
      },
      {
        path: '/verify-contract',
        mappingPolicy: true,
        aliases: {
          'POST /v1/evm/file': {
            bodyParsers: {
              json: false,
              urlencoded: false,
            },
            busboyConfig: {
              limits: {
                files: config.jobVerifyContractEVM.configUploadFile.files,
                fileSize: config.jobVerifyContractEVM.configUploadFile.fileSize,
              },
            },
            type: 'multipart',
            action: 'v1.verify-contract-evm.create-request',
          },
        },
      },
    ],
    // empty cors object will have moleculer to generate handler for preflight request and CORS header which allow all origin
    cors: {},
  },
})
export default class ApiService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }
}

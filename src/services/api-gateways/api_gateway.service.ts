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
          'v1.services-manager.*',
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
        ],
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

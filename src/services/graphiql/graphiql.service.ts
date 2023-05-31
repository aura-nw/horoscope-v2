/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * API Gateway class
 * Just receive request from client, parse param and forward to coresponding bussiness Service(s)
 * PLEASE DONT PUT BUSINESS LOGIC HERE
 *  to list : curl localhost:3000/graphiql/GraphiQLService/list-aliases | jq '.[] | select(.actionName| contains("PersonService.sayWelcome"))'
 */

import ApiGateway from 'moleculer-web';
import { Context, ServiceBroker } from 'moleculer';
import { Post, Service } from '@ourparentcenter/moleculer-decorators-extended';
import BaseService from '../../base/base.service';
import { bullBoardMixin } from '../../mixins/bullBoard/bullBoard.mixin';
import Utils from '../../common/utils/utils';

@Service({
  mixins: [ApiGateway, bullBoardMixin()],
  settings: {
    routes: [
      {
        path: '/graphiql',
        autoAliases: true, // allow generate rest info (GET/PUT/POST...) in the services
        mappingPolicy: 'restrict', // allow action called with exact method
      },
    ],
    // empty cors object will have moleculer to generate handler for preflight request and CORS header which allow all origin
    cors: {},
  },
})
export default class GraphiQLService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * call it with curl  --request POST 'http://0.0.0.0:3000/graphiql'
   * Schema for validattion
   */
  @Post('/')
  public handleGraphQlQuery(ctx: Context<any>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { operationName, query, variables } = ctx.params;
    if (Utils.getDepth(JSON.parse(query)) > 3) {
      const result = {
        code: 'ERROR',
        message: 'The query depth must not be greater than 3',
        data: query,
      };
      return result;
    }
    return null;
  }
}

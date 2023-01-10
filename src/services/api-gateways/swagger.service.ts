import OpenApi from 'moleculer-auto-openapi';
import { ServiceBroker } from 'moleculer';

import { Service } from '@ourparentcenter/moleculer-decorators-extended';
// import BaseService from 'src/base/BaseService';
import BaseService from '../../base/BaseService';

@Service({
  mixins: [OpenApi],
  name: 'openapi',
  actions: {
    // Add alias information for default openapi actions
    ui: {
      rest: 'GET /ui',
    },
    generateDocs: {
      rest: 'GET /openapi.json',
    },
    assets: {
      rest: 'GET /assets/:file',
    },
  },
  settings: {
    openapi: {
      info: {
        description: 'this is Site OpenApi',
        title: 'swagger openapi ',
      },
      tags: [
        // you tags
        { name: 'auth', description: 'My custom name' },
      ],
      components: {
        // you auth
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
    },
  },
})
export default class ApiService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }
}

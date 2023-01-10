/* eslint-disable @typescript-eslint/no-var-requires */
import { ServiceBroker, Context } from 'moleculer';

import {
  Delete,
  Get,
  Post,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
// import BaseService from 'src/base/BaseService';
// TODO: Not very happy with relative import,
//  but ts-node loader does not support yet with type alias for ESM project, will try to fix later
import { inspect } from 'util';
import Person from '../../models/Person';
import BaseService from '../../base/BaseService';

@Service()
export default class PersonService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Get('/')
  public async listPerson(): Promise<Person[]> {
    return Person.query().whereNotDeleted();
  }

  @Get('/:id', {
    openapi: {
      summary: 'retrieve detail data for a person',
    },
    params: {
      id: { type: 'number' },
    },
  })
  public async personbyId(
    ctx: Context<{ id: number }>
  ): Promise<Person | undefined> {
    const userId = ctx.params.id;
    return Person.query().findById(userId);
    // return `Welcome, ${JSON.stringify(ctx.params.name)}`;
  }

  @Delete('/del/:id', {
    openapi: {
      summary: 'Delete a person knowing its id',
      responses: {
        200: {
          description: 'delete success',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  example: {
                    id: 1,
                    filename: 'foo.txt',
                    mimetype: 'text/plain',
                    sizeInBytes: 100,
                  },
                },
              },
            },
          },
        },
      },
    },
    params: {
      id: { type: 'number' },
    },
  })
  public async delById(ctx: Context<{ id: number }>): Promise<number> {
    const userId = ctx.params.id;
    return Person.query().deleteById(userId);
    // return `Welcome, ${JSON.stringify(ctx.params.name)}`;
  }

  @Post('/add', {
    openapi: {
      summary: 'Add a new person',
    },
    params: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    },
  })
  public async add(
    ctx: Context<{ firstName: string; lastName: string }>
  ): Promise<Person> {
    // return `Welcome, ${JSON.stringify(ctx.params.name)}`;

    this.logger.info('In add method', ctx.params.firstName);
    const e = Person.query().insert({
      firstName: ctx.params.firstName,
      lastName: ctx.params.lastName,
    });

    this.logger.info(`inserted: ${inspect(e)}`);
    return e;
  }
}

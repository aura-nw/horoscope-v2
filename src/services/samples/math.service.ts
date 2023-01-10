/* eslint-disable @typescript-eslint/no-var-requires */
import { ServiceBroker, Context } from 'moleculer';

import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
// import BaseService from 'src/base/BaseService';
// TODO: Not very happy with relative import,
//  but ts-node loader does not support yet with type alias for ESM project, will try to fix later
import BaseService from '../../base/BaseService';

@Service()
export default class SimpleMathService extends BaseService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * Action will not expose http endpoint, as well as swagger api.
   * Use internal only
   */
  @Action({
    params: {
      a: 'number',
      b: 'number',
    },
  })
  public add(ctx: Context<{ a: number; b: number }>) {
    return ctx.params.a + ctx.params.b;
  }

  @Action({
    params: {
      a: 'number',
      b: 'number',
    },
  })
  public sub(ctx: Context<{ a: number; b: number }>) {
    return ctx.params.a - ctx.params.b;
  }

  @Action({
    params: {
      a: 'number',
      b: 'number',
    },
  })
  public mul(ctx: Context<{ a: number; b: number }>) {
    return ctx.params.a * ctx.params.b;
  }
}

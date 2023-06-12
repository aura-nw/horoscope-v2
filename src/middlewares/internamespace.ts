import _ from 'lodash';
import { ServiceBroker } from 'moleculer';

function InterNamespaceMiddleware(opts: any) {
  if (!Array.isArray(opts)) throw new Error('Must be an Array');

  let thisBroker: ServiceBroker;
  const brokers = {};

  return {
    created(broker: ServiceBroker) {
      thisBroker = broker;
      opts.forEach((nsOpts) => {
        if (_.isString(nsOpts)) {
          // eslint-disable-next-line no-param-reassign
          nsOpts = {
            namespace: nsOpts,
          };
        }
        const ns = nsOpts.namespace;

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.logger.info(
          `Create internamespace broker for '${ns} namespace...'`
        );
        const brokerOpts = _.defaultsDeep(
          {},
          nsOpts,
          { nodeID: null, middlewares: null },
          broker.options
        );
        brokers[ns] = new ServiceBroker(brokerOpts);
      });
    },

    started() {
      return Promise.all(Object.values(brokers).map((b: any) => b.start()));
    },

    stopped() {
      return Promise.all(Object.values(brokers).map((b: any) => b.stop()));
    },

    call(next: any) {
      return function (actionName: any, params: any, opts = {}) {
        if (_.isString(actionName) && actionName.includes('@')) {
          const [action, namespace] = actionName.split('@');

          if (brokers[namespace]) {
            return brokers[namespace].call(action, params, opts);
          }
          if (namespace === thisBroker.namespace) {
            return next(action, params, opts);
          }
          throw new Error(`Unknow namespace: ${namespace}`);
        }

        return next(actionName, params, opts);
      };
    },
  };
}

export default InterNamespaceMiddleware;

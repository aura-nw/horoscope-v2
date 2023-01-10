import { Service as MService, ServiceBroker } from 'moleculer';

export default class BaseService extends MService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  async stopped() {
    this.logger.info(` Stopping service ${this.name}...`);
  }
}

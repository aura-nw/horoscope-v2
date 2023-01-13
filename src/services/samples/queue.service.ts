/* eslint-disable no-console */
import { ServiceBroker } from 'moleculer';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { inspect as _inspect } from 'util';
//
// TODO: Not very happy with relative import,
//  but ts-node loader does not support yet with type alias for ESM project, will try to fix later
import BullableService, { QueueHandler } from '../../base/BullableService';

@Service()
export default class QueueSampleService extends BullableService {
  public static instanceCreation: any[] = [];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action()
  public addJob1(): string {
    const queueName = 'tuanbass';
    const jobType = 'hello';
    this.createJob(queueName, jobType, { data: 'It\'s a good day...' });
    return 'Job schduled';
  }

  @Action()
  public addJob2(): string {
    const qName = 'QueueSampleService'; // QueueSampleService
    const jType = QueueSampleService.prototype.defaultHandler.name; // defaultHandler
    console.log(`${qName}, ${jType}`);
    this.createJob(qName, jType, {
      data: 'Handler without specify queue option',
    });
    return 'Job schduled';
  }

  @QueueHandler({
    queueName: 'tuanbass',
    jobType: 'hello',
    prefix: '__testprefix',
  })
  private async jobHandler(_payload: object): Promise<void> {
    console.log(
      `job handler: printing something to test.. ${JSON.stringify(_payload)}`
    );
    console.log(
      ' Do not access to `this` inside this handler, it\'s a limitation for the moment '
    );
    // console.log(this.name) => IT WILL FAIL
  }

  /**
   * If queue option is omitted, default queueName and jobType will be generated using
   * class and method name
   */
  @QueueHandler({})
  private async defaultHandler(_payload: object): Promise<void> {
    console.log(_payload);
  }
}

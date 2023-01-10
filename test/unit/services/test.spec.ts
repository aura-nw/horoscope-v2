import { expect } from '@jest/globals';

import { Describe, BeforeAll, Test, AfterAll } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import TestService from '../../../src/services/samples/math.service';

@Describe('Test math service')
export default class MathTest {
  broker = new ServiceBroker({ logger: false });

  @BeforeAll()
  initSuite() {
    this.broker.start();
    this.broker.createService(TestService) as TestService;
  }

  @AfterAll()
  tearDown() {
    this.broker.stop();
  }

  @Test('Test of Sub action in normal case ')
  public async testSub_normal() {
    const res = await this.broker.call('SimpleMathService.sub', { a: 3, b: 2 });
    expect(res).toBe(1);
  }

  @Test('Test of Sub action in negative case ')
  public async testSub_negative() {
    const res = await this.broker.call('SimpleMathService.sub', {
      a: -3,
      b: -2,
    });
    expect(res).toBe(-1);
  }
}

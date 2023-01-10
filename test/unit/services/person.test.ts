import { expect } from '@jest/globals';

import { Describe, BeforeAll, Test, AfterAll } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../src/common/utils/db-connection';
import TestService from '../../../src/services/samples/persons.service';

@Describe('Test Person service')
export default class PersonTest {
  broker = new ServiceBroker({ logger: false });

  // Mocking DAO
  // Person.query();
  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.broker.createService(TestService) as TestService;

    // console.debug('before seeding');
    await knex.seed.run({
      specific: 'person.ts',
    });
    // console.debug('affter seeding');
  }

  @AfterAll()
  tearDown() {
    this.broker.stop();
    knex.destroy();
  }

  @Test('list all persons')
  public async testListPerson() {
    const res = (await this.broker.call(
      'PersonService.listPerson'
    )) as object[];
    expect(res.length).toBe(4);
  }

  @Test('list person by id')
  public async testSub_negative() {
    const res = await this.broker.call('PersonService.personbyId', { id: 1 });
    // console.debug(`result: ${JSON.stringify(res)}`);
    expect(res).toMatchObject({
      firstName: expect.any(String),
      lastName: expect.any(String),
    });
  }

  @Test('del a persons by id')
  public async testDelPerson() {
    const res = await this.broker.call('PersonService.delById', { id: 1 });
    expect(res).toBe(1);
  }
}

/* eslint-disable no-console */
import { inspect } from 'util';

import knex from '../common/utils/db';
import Person from './Person';

// Initialize knex.

// Bind all Models to the knex instance. You only
// need to do this once before you use any of
// your model classes.
Person.knex(knex);

async function main() {
  // Delete all persons from the db.
  // await Person.query().delete();
  // const countPerson = await Person.query().count('id as total');
  // console.log(` total: ${JSON.stringify(countPerson[0]['total'])}`);

  // delete first person
  const firstPerson = await Person.query().whereNotDeleted().first();
  // console.log(`first person: ${JSON.stringify(firstPerson)}`);
  console.log(`first person: ${inspect(firstPerson)}, ${firstPerson?.$id()}`);

  // TODO: check how to use POJO (ModelObject) here
  // let firtPersonPojo: PersonPoJo = Object.assign({}, firstPerson);

  // await Person
  //   .query()
  //   .delete(false)
  //   .where('id', '=', firstPerson?.id as number);

  await Person.query().deleteById(firstPerson?.$id());
  //
  // Insert one row to the database.
  await Person.query().insert({
    firstName: 'Jennifer',
    lastName: 'Aniston',
  });

  // console.log(await Person.query().count());

  // Read all rows from the db.
  // const people = await Person.query();
  //
  // console.log(people);
}

main()
  .then(() => knex.destroy())
  .catch((err) => {
    console.error(err);
    return knex.destroy();
  });

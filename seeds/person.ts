/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('persons').del();

  // Inserts seed entries
  await knex('persons').insert([
    { id: 1, firstName: 'Tuan', lastName: 'Bass' },
    { id: 2, firstName: 'Jade', lastName: 'Untamable' },
    { id: 3, firstName: 'Cassie', lastName: 'Cage' },
    { id: 4, firstName: 'Jax', lastName: 'Briggs' },
  ]);
}

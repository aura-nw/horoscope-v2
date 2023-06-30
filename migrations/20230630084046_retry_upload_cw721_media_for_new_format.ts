import { Knex } from 'knex';
import { Config } from '../src/common';

export async function up(knex: Knex): Promise<void> {
  const tokens_new_token_uri = await knex
    .table('cw721_token')
    .whereRaw("media_info->'onchain'->>'token_uri' like '/ipfs/%'")
    .select('id');
  const tokens_new_image = await knex
    .table('cw721_token')
    .whereRaw("media_info->'onchain'->'metadata'->>'image' like '/ipfs/%'")
    .select('id');
  const tokens_new_animation = await knex
    .table('cw721_token')
    .whereRaw(
      "media_info->'onchain'->'metadata'->>'animation_url' like '/ipfs/%'"
    )
    .select('id');
  if (
    tokens_new_animation.length > 0 ||
    tokens_new_image.length > 0 ||
    tokens_new_token_uri.length > 0
  ) {
    await knex
      .table('cw721_token')
      .update({ media_info: null })
      .whereIn(
        'id',
        [
          ...tokens_new_token_uri,
          ...tokens_new_animation,
          ...tokens_new_image,
        ].map((e) => e.id)
      );
  }
}

export async function down(knex: Knex): Promise<void> {}

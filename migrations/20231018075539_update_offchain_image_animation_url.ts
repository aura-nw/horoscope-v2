import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  const tokens_with_image = await knex
    .table('cw721_token')
    .whereRaw("media_info->'onchain'->'metadata'->>'image' LIKE ?", [`http%`])
    .orWhereRaw("media_info->'onchain'->'metadata'->>'image' LIKE ?", [
      `/ipfs/%`,
    ])
    .orderBy('id');
  await knex
    .table('cw721_token')
    .update({
      media_info: null,
    })
    .whereIn(
      'id',
      tokens_with_image.map((token) => token.id)
    );
  const tokens_with_animation = await knex
    .table('cw721_token')
    .whereRaw("media_info->'onchain'->'metadata'->>'animation_url' LIKE ?", [
      `http%`,
    ])
    .orWhereRaw("media_info->'onchain'->'metadata'->>'animation_url' LIKE ?", [
      `/ipfs/%`,
    ])
    .orderBy('id');
  await knex
    .table('cw721_token')
    .update({
      media_info: null,
    })
    .whereIn(
      'id',
      tokens_with_animation.map((token) => token.id)
    );
}

export async function down(knex: Knex): Promise<void> {}

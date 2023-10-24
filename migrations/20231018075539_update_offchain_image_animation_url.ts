import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  const tokens_with_image = await knex
    .table('cw721_token')
    .whereRaw("media_info->'onchain'->'metadata'->>'image' LIKE ?", [`http%`])
    .orWhereRaw("media_info->'onchain'->'metadata'->>'image' LIKE ?", [
      `/ipfs/%`,
    ])
    .orderBy('id');
  for (const token of tokens_with_image) {
    await knex
      .table('cw721_token')
      .update({
        media_info: null,
      })
      .where('id', token.id);
  }
  const tokens_with_animation = await knex
    .table('cw721_token')
    .whereRaw("media_info->'onchain'->'metadata'->>'animation' LIKE ?", [
      `http%`,
    ])
    .orWhereRaw("media_info->'onchain'->'metadata'->>'animation' LIKE ?", [
      `/ipfs/%`,
    ])
    .orderBy('id');
  for (const token of tokens_with_animation) {
    await knex
      .table('cw721_token')
      .update({
        media_info: null,
      })
      .where('id', token.id);
  }
}

export async function down(knex: Knex): Promise<void> {}

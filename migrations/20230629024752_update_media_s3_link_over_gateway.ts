import { Knex } from 'knex';
import { Config } from '../src/common';
const { S3_GATEWAY } = Config;

export async function up(knex: Knex): Promise<void> {
  const tokens_with_image = await knex
    .table('cw721_token')
    .whereRaw("media_info->'offchain'->>'image'!=?", [{}])
    .orderBy('id');
  for (const token of tokens_with_image) {
    await knex
      .table('cw721_token')
      .update({
        media_info: knex.jsonSet('media_info', '{offchain,image}', {
          url: S3_GATEWAY + token.media_info.offchain.image.file_path,
          file_path: token.media_info.offchain.image.file_path,
          content_type: token.media_info.offchain.image.content_type,
        }),
      })
      .where('id', token.id);
  }
  const tokens_with_animation = await knex
    .table('cw721_token')
    .whereRaw("media_info->'offchain'->>'animation'!=?", [{}])
    .orderBy('id');
  for (const token of tokens_with_animation) {
    await knex
      .table('cw721_token')
      .update({
        media_info: knex.jsonSet('media_info', '{offchain,animation}', {
          url: S3_GATEWAY + token.media_info.offchain.animation.file_path,
          file_path: token.media_info.offchain.animation.file_path,
          content_type: token.media_info.offchain.animation.content_type,
        }),
      })
      .where('id', token.id);
  }
}

export async function down(knex: Knex): Promise<void> {}

import BaseModel from './base';

export class EvmSignatureMapping extends BaseModel {
  topic_hash!: string;

  human_readable_topic!: string;

  minimal_topic_hash!: string;

  static get tableName() {
    return 'evm_signature_mapping';
  }

  static get idColumn(): string {
    return 'topic_hash';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['topic_hash', 'human_readable_topic'],
      properties: {
        topic_hash: { type: 'string' },
        human_readable_topic: { type: 'string' },
      },
    };
  }
}

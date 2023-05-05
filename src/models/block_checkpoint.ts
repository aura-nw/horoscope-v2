import BaseModel from './base';
import { EventAttribute } from './event_attribute';
import config from '../../config.json' assert { type: 'json' };

export class BlockCheckpoint extends BaseModel {
  job_name!: string;

  height!: number;

  static get tableName() {
    return 'block_checkpoint';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['job_name', 'height'],
      properties: {
        job_name: { type: 'string' },
        height: { type: 'number' },
      },
    };
  }

  static async getCheckpoint(
    jobName: string,
    configName?: string
  ): Promise<[number, number, BlockCheckpoint]> {
    const [checkpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      EventAttribute | undefined
    ] = await Promise.all([
      BlockCheckpoint.query().select('*').findOne('job_name', jobName),
      EventAttribute.query()
        .select('block_height')
        .findOne({})
        .orderBy('block_height', 'desc'),
    ]);

    let startHeight = 0;
    let endHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (checkpoint) {
      startHeight = checkpoint.height;
      updateBlockCheckpoint = checkpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: jobName,
        height: 0,
      });

    if (latestBlock)
      endHeight = configName
        ? Math.min(
            startHeight + config[configName].blocksPerCall,
            latestBlock.block_height
          )
        : latestBlock.block_height;

    return [startHeight, endHeight, updateBlockCheckpoint];
  }
}

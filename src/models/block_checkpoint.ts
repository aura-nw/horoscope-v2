import config from '../../config.json' assert { type: 'json' };
import BaseModel from './base';

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
    lastHeightJobNames: string[],
    configName?: string
  ): Promise<[number, number, BlockCheckpoint]> {
    const [jobCheckpoint, lastHeightCheckpoint] = await Promise.all([
      BlockCheckpoint.query().select('*').where('job_name', jobName).first(),
      BlockCheckpoint.query()
        .select('*')
        .whereIn('job_name', lastHeightJobNames)
        .orderBy('height', 'ASC')
        .first(),
    ]);
    let startHeight = 0;
    let endHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (jobCheckpoint) {
      startHeight = jobCheckpoint.height;
      updateBlockCheckpoint = jobCheckpoint;
    } else {
      startHeight = config.crawlBlock.startBlock;
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: jobName,
        height: config.crawlBlock.startBlock,
      });
    }

    if (lastHeightCheckpoint)
      endHeight = configName
        ? Math.min(
            startHeight + config[configName].blocksPerCall,
            lastHeightCheckpoint.height
          )
        : lastHeightCheckpoint.height;

    return [startHeight, endHeight, updateBlockCheckpoint];
  }
}

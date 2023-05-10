import BaseModel from './base';
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
    lastHeightJobName: string,
    configName?: string
  ): Promise<[number, number, BlockCheckpoint]> {
    const checkpoint: BlockCheckpoint[] = await BlockCheckpoint.query()
      .select('*')
      .whereIn('job_name', [jobName, lastHeightJobName]);

    let startHeight = 0;
    let endHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    const jobCheckpoint = checkpoint.find(
      (check) => check.job_name === jobName
    );
    const lastHeightCheckpoint = checkpoint.find(
      (check) => check.job_name === lastHeightJobName
    );
    if (jobCheckpoint) {
      startHeight = jobCheckpoint.height;
      updateBlockCheckpoint = jobCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: jobName,
        height: 0,
      });

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

// TODO: add logic to inject redis information here instead of get from environment

import { RedisOptions } from 'bullmq';

// let path = process.env.BULL_REDIS_URL
// const redisConnection = getRedisConnection(path);
// export default redisConnection;

export function getRedisConnection(path?: string): RedisOptions {
  // TODO: it could be better to get the data from other instead of fixed in process environment
  // eslint-disable-next-line @typescript-eslint/naming-convention
  let _path = path ?? process.env.QUEUE_JOB_REDIS;
  _path = _path ?? '';

  const res = getIORedisInstance(_path);
  return res;
}

function getIORedisInstance(path: string): RedisOptions {
  try {
    const url = new URL(path);
    const db = url.pathname ? parseInt(url.pathname.substr(1), 10) : 0;

    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      username: url.username,
      password: url.password,
      db,
    };
  } catch (e) {
    return {
      host: 'localhost',
      port: 6379,
    };
  }

  // if (_ioRedis) return _ioRedis;
  //
  // // no redisconnection, create one
  // const opt: RedisOptions = { maxRetriesPerRequest: null , };
  // _ioRedis = path ? new IORedis(path, opt) : new IORedis(opt);
  // return _ioRedis;
}

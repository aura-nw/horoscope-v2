# Contributing

## Add new network

-   Add network information to network.json file
``` json
{
  "chainId": "pacific-1",
  "RPC": ["https://rpc-sei.toolsme.pro/"],
  "LCD": ["https://rest.cosmos.directory/sei"],
  "databaseName": "local_sei",
  "redisDBNumber": 0,
  "moleculerNamespace": "horoscope-v2-dev-sei-pacific"
}
```
- Update file .env
``` env
# only run crawl block and crawl tx service
SERVICES=crawl-block/crawl_block.service.ts,crawl-tx/crawl_tx.service.ts

# redis
TRANSPORTER=redis://127.0.0.1:6379
CACHER=redis://127.0.0.1:6379
QUEUE_JOB_REDIS=redis://127.0.0.1:6379

# postgres
POSTGRES_USER=erascope
POSTGRES_PASSWORD=erascopePwd
POSTGRES_DB=indexer
POSTGRES_DB_TEST=indexer-test
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```
- Update config.json
```json
{
  "chainId": "pacific-1",
  "crawlBlock": {
    // start block to crawl
    "startBlock": 4860000
  },
  ...,
  "migrationEventAttributeToPartition": {
    // partition range for partition table event attribute
    "startBlock": 0,
    "endBlock": 13000000,
    "step": 13000000,
  }
  ...
}
```

## Development Procedure

- Fork the repo and clone it to your local machine, use branch MAIN
- Create your service in the service folder using [Moleculerjs](https://moleculer.services/) framework
- Make some commit, submit PR to MAIN branch

## Decode transaction with Telescope
In order to decode tx, please use Telescope to generate your typescript proto with this config: [aurajs config](https://github.com/aura-nw/aurajs/blob/feat/aurad-v0.7.2/.telescope.json)
```json
{
  "protoDirs": [],
  "outPath": "./src/codegen",
  "options": {
    "aminoEncoding": {
      "enabled": true
    },
    "lcdClients": {
      "enabled": true
    },
    "rpcClients": {
      "enabled": true
    },
    "prototypes": {
      "typingsFormat": {
        "timestamp": "date",
        "duration": "string",
        "num64": "long"
      },
      "methods": {
        "fromJSON": true,
        "toJSON": true,
        "encode": true,
        "decode": true,
        "fromPartial": true,
        "toAmino": false,
        "fromAmino": false,
        "fromProto": false,
        "toProto": false
      }
    },
    "interfaces":{
      "enabled": false
    }
  }
}
```


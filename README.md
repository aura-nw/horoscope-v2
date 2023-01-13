# Erascope

## Development

In order to run Erascope up in local enviroment, there are many ways. But i suggest you run all nesessary services to start up by create them in docker. We define all nesessary service in file [docker-compose](/docker/dev.docker-compose.yml), you can run only one command to start all of them:

```bash
$ yarn build && yarn run up
```

## YARN scripts

- `yarn  dev`: Start development mode (load all services locally with hot-reload & REPL)
- `yarn  start`: Start production mode (set `SERVICES` env variable to load certain services)
- `yarn  lint`: Run ESLint

## Services

- **api-gateways**: API Gateway services
- **samples**: Sample service with `hello` and `welcome` actions.

### Test

Start aurad for test

```
docker run --rm -p 26667:26657 --name aurad-test --network erascope_dev_network aurad-test
```

Test:

```
yarn test
```

Need `runInBand` option because blockchain interactions cannot happen in parallel.

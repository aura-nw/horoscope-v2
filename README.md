[![Moleculer](https://badgen.net/badge/Powered%20by/Moleculer/0e83cd)](https://moleculer.services)

# ts-mole

This is a [Moleculer](https://moleculer.services/)-based microservices base project. Written in Typescript

## Features

Based on moleculer typescript template (https://github.com/moleculerjs/moleculer-template-project-typescript/tree/master/template)
With following addtional features:

- [x] ESM base project
- [x] Decorators support for Actions, Methods, Event... (with sample)
- [x] Decorators support for Bull Queue (with sample)
- [x] Swagger auto-generated from decorators
- [x] Access RDBMS using projectionjs (with sample)
  - [x] With support for Soft delete
- [ ] Code quality tools
  - [x] EditorConfig support (https://editorconfig.org/)
  - [x] Pre-configured Pretier
  - [x] Pre-configured esLint (inherited from airbnb config) with some modifications)
- [ ] broker.call() by static link instead of strings (easier for source code navigation: Ctrl-Click)
- [x] Unit test with jest
- [ ] Enforment of git commit policies:
  - [x] Lint error free (auto run lint for all staged file before "git commit")
  - [x] force pretier before commit
  - [ ] Force run [gitleaks](https://github.com/zricethezav/gitleaks) to check if in the commit has credential leaks...
  - [x] follow "Semantic Commit Message" [policies](https://www.conventionalcommits.org/en/v1.0.0/) using husky and lint-staged
  - [x] force run "yarn test" and "yarn lint" (full lint for whole repository) before push
- [ ] Support of a faster compiler (SWC/ESBUILD) rather TSC
- [ ] Auto configure (Enforcement of default value for required settings)
- [ ] Easy configuration for Jaeger/OpenTracing
- [ ] Easy version management for services
- [ ] Change it to a template, so can be used with `moleculer init`
- [x] Hot reload when code changes (--watch)
- [ ] Convert to yarn2

And lots more...

## Open points

- Cannot use module alias when importing. Need to use relative path import (it's actually problem of ESM loader with ts-node). Will try to fix later
- QueueHander: Cannot acess "this" inside queue handler. If you need to access "this", include it in the payload when creating jobs

## Semantic commit message sample

Reference:
https://ec.europa.eu/component-library/v1.15.0/eu/docs/conventions/git/

## Usage

Start the project with `npm run dev` command.
After starting, open the http://localhost:3000/ URL in your browser.
On the welcome page you can test the generated services via API Gateway and check the nodes & services.

In the terminal, try the following commands:

- `nodes` - List all connected nodes.
- `actions` - List all registered service actions.
- `call greeter.hello` - Call the `greeter.hello` action.
- `call greeter.welcome --name John` - Call the `greeter.welcome` action with the `name` parameter.
- `call products.list` - List the products (call the `products.list` action).

## YARN scripts

- `yarn  dev`: Start development mode (load all services locally with hot-reload & REPL)
- `yarn  start`: Start production mode (set `SERVICES` env variable to load certain services)
- `yarn  cli`: Start a CLI and connect to production. Don't forget to set production namespace with `--ns` argument in script
- `yarn  lint`: Run ESLint

## Services

- **api**: API Gateway services
- **greeter**: Sample service with `hello` and `welcome` actions.
- **products**: Sample DB service. To use with MongoDB, set `MONGO_URI` environment variables and install MongoDB adapter with `npm i moleculer-db-adapter-mongo`.

## Mixins

- **db.mixin**: Database access mixin for services. Based on [moleculer-db](https://github.com/moleculerjs/moleculer-db#readme)

## Useful links

- Moleculer website: https://moleculer.services/
- Moleculer Documentation: https://moleculer.services/docs/-1.14/

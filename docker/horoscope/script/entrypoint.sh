set -e
cp code-type.json dist/code-type.json
cp config.json dist/config.json
cp network.json dist/network.json
npm run db:migrate:latest
npm run start
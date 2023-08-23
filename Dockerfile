FROM node:16-alpine

## Install hasura cli
RUN apk update && apk add bash curl && curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash

# Working directory
WORKDIR /app

# Install dependencies
ARG NPM_TOKEN
RUN echo "@aura-nw:registry=https://npm.pkg.github.com"  >> .npmrc && echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> .npmrc
COPY package.json package.json ./
RUN npm install && rm .npmrc

# Copy source
COPY . .

# Build and cleanup
ENV NODE_ENV=production
RUN npm run build

# Start server
CMD ["npm", "run", "start"]
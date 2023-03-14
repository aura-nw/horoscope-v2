FROM node:16-alpine

# Working directory
WORKDIR /app

# Install dependencies
ARG NPM_TOKEN
RUN echo "@aura-nw:registry=https://npm.pkg.github.com"  >> .npmrc && echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> .npmrc
COPY package.json package.json ./
RUN yarn install && rm .npmrc

# Copy source
COPY . .

# Build and cleanup
ENV NODE_ENV=production
RUN yarn build

# Start server
CMD ["yarn", "start"]
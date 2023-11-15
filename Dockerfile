FROM node:16-alpine

# Working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json yarn.lock ./
RUN yarn install

# Copy source
COPY . .

# Build and cleanup
ENV NODE_ENV=production
RUN yarn build

# Start server
CMD ["yarn", "start"]
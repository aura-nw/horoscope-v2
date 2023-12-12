FROM node:16-alpine

# Working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source
COPY . .

# Build and cleanup
ENV NODE_ENV=production
RUN npm run build

# Start server
CMD ["npm", "start"]

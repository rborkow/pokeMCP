FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy built application and data files
COPY build/ ./build/
COPY src/data/ ./src/data/

# Run the MCP server
CMD ["node", "build/index.js"]

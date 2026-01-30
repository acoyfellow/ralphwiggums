FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install

# Copy source
COPY . .

# Expose port
EXPOSE 8081

# Start the container server (has /do, /health endpoints)
CMD ["bun", "run", "container/server.ts"]

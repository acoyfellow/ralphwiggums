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

# Start the server
CMD ["bun", "run", "server.js"]

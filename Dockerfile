FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install

COPY container/ .

EXPOSE 8081
CMD ["bun", "run", "--hot", "server.ts"]

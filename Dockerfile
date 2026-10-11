# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY . .
RUN bun run build:client

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/public ./public
COPY src ./src

USER bun

EXPOSE 3000

CMD ["bun", "run", "start"]

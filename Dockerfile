FROM oven/bun:1-debian AS bun-bin

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    latexmk \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=bun-bin /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["bun", "run", "src/server/server.ts"]
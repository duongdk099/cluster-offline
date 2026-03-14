FROM oven/bun:1 as base

WORKDIR /usr/src/app

COPY package.json ./
# Bun uses package.json directly for install if no lockfile is present
RUN bun install

COPY . .

EXPOSE 3001

CMD ["bun", "run", "start"]

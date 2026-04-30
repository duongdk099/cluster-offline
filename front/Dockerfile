# Stage 1: Build WASM
FROM rust:alpine AS wasm-builder
WORKDIR /image-wasm
RUN apk add --no-cache wasm-pack
COPY ./image-wasm .
RUN wasm-pack build --release

# Stage 2: Build Nuxt
FROM node:20-alpine AS builder
RUN npm i -g pnpm
WORKDIR /usr/src/app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY ./api/package.json ./api/package.json
COPY ./front/package.json ./front/package.json
COPY --from=wasm-builder /image-wasm/pkg ./image-wasm/pkg

ARG NUXT_PUBLIC_API_URL=http://localhost:3001
ARG NUXT_PUBLIC_WS_URL=ws://localhost:3001/ws
ENV NUXT_PUBLIC_API_URL=$NUXT_PUBLIC_API_URL
ENV NUXT_PUBLIC_WS_URL=$NUXT_PUBLIC_WS_URL

RUN pnpm install
COPY ./front ./front
WORKDIR /usr/src/app/front
RUN pnpm run build

# Stage 3: Runner Nitro node-server
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /usr/src/app/front/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

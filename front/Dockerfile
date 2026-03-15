# Stage 1: Build WASM
FROM rust:alpine AS wasm-builder
WORKDIR /image-wasm
RUN apk add --no-cache wasm-pack
COPY ./image-wasm .
RUN wasm-pack build --release

# Stage 2: Build Next.js
FROM node:20-alpine AS builder
RUN npm i -g pnpm

# Use the workspace root
WORKDIR /usr/src/app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY ./api/package.json ./api/package.json
COPY ./front/package.json ./front/package.json

COPY --from=wasm-builder /image-wasm/pkg ./image-wasm/pkg

# Public client envs must be available during build for Next.js client bundles.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Install workspace dependencies properly
RUN pnpm install

# Copy the actual code AFTER dependencies so we don't overwrite node_modules
COPY ./front ./front

WORKDIR /usr/src/app/front
RUN pnpm run build 

# Stage 3: Runner (Nhẹ và nhanh)
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=3000

# Copy Next.js standalone generated files
# Since it's a monorepo, next.js outputs the app inside standalone/front
COPY --from=builder /usr/src/app/front/public ./front/public
COPY --from=builder /usr/src/app/front/.next/standalone ./
COPY --from=builder /usr/src/app/front/.next/static ./front/.next/static

EXPOSE 3000
CMD ["node", "front/server.js"]
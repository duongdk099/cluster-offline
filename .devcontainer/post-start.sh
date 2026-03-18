#!/usr/bin/env bash
set -euo pipefail

upsert_kv() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp

  tmp="$(mktemp)"
  grep -v "^${key}=" "$file" > "$tmp" || true
  printf "%s=%s\n" "$key" "$value" >> "$tmp"
  mv "$tmp" "$file"
}

ensure_file_from_example() {
  local target="$1"
  local source="$2"
  if [[ ! -f "$target" && -f "$source" ]]; then
    cp "$source" "$target"
  fi
}

# Keep DB available for local tools and startup checks.
docker compose up -d db
sleep 4
(
  cd api
  bun run db:push
)

# Auto-configure Codespaces env values to prevent CORS and mixed-origin issues.
if [[ -n "${CODESPACE_NAME:-}" ]]; then
  FRONT_ORIGIN="https://${CODESPACE_NAME}-3000.app.github.dev"
  API_ORIGIN="https://${CODESPACE_NAME}-3001.app.github.dev"
  WS_ORIGIN="wss://${CODESPACE_NAME}-3001.app.github.dev/ws"

  ensure_file_from_example "api/.env" "api/.env.example"
  ensure_file_from_example "api/.env.local" "api/.env.example"
  ensure_file_from_example "front/.env.local" "front/.env.example"

  for api_env in "api/.env" "api/.env.local"; do
    upsert_kv "$api_env" "CORS_ORIGIN" "${FRONT_ORIGIN},${API_ORIGIN},http://localhost:3000"
    upsert_kv "$api_env" "API_URL" "${API_ORIGIN}"
    upsert_kv "$api_env" "TRUST_PROXY_HEADERS" "true"
  done

  upsert_kv "front/.env.local" "NEXT_PUBLIC_API_URL" "${API_ORIGIN}"
  upsert_kv "front/.env.local" "NEXT_PUBLIC_WS_URL" "${WS_ORIGIN}"
  upsert_kv "front/.env.local" "NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS" "${FRONT_ORIGIN},localhost:3000"
fi

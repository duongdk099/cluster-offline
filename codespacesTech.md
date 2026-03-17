# Codespaces Technical Notes

This file documents configuration that is mainly needed when running this project in GitHub Codespaces (forwarded domains / reverse proxy). On local machine or typical VPS deployment, most of these workarounds are not needed.

## 1. Next.js Server Actions origin/host mismatch

### Symptom
- Error like:
  - `x-forwarded-host header ... does not match origin header ...`
  - `Invalid Server Actions request`

### Why it happens in Codespaces
- Browser uses forwarded URL (`*.app.github.dev`) while some requests still carry `localhost` origin.
- Next.js blocks Server Actions for security when origin/host are not trusted.

### Codespaces-specific fix
- In [front/next.config.ts](front/next.config.ts), allow forwarded origins:
  - `localhost:3000`
  - `127.0.0.1:3000`
  - `*.app.github.dev`
  - optional extra values from `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS`

### Usually not needed on local/VPS
- If app is accessed via one stable domain (or localhost only), this mismatch normally does not occur.

## 2. API and WebSocket public URLs

### Codespaces requirement
- Frontend must call API through forwarded HTTPS/WSS domain, not localhost.
- Example in [front/.env.local](front/.env.local):
  - `NEXT_PUBLIC_API_URL=https://<codespace>-3001.app.github.dev`
  - `NEXT_PUBLIC_WS_URL=wss://<codespace>-3001.app.github.dev/ws`

### Usually not needed on local/VPS
- Local: `http://localhost:3001` and `ws://localhost:3001/ws` are enough.
- VPS: direct domain (no Codespaces forwarded host logic).

## 3. CORS allowed origins

### Codespaces requirement
- Backend CORS needs forwarded frontend/backend origins in [api/.env](api/.env).
- Example:
  - `CORS_ORIGIN=https://<codespace>-3000.app.github.dev,https://<codespace>-3001.app.github.dev`

### Usually not needed on local/VPS
- Local often just needs `http://localhost:3000`.
- VPS often uses one known frontend domain.

## 4. Upload image URL generation behind proxy

### Symptom
- Uploaded files exist under [api/uploads](api/uploads) but images do not render in UI.

### Why it happens in Codespaces
- If API returns image URL with `http://localhost:3001/uploads/...`, browser at `*.app.github.dev` cannot load it.

### Codespaces-safe fix
- API upload endpoint in [api/src/index.ts](api/src/index.ts) now derives base URL from:
  - `x-forwarded-host`
  - `x-forwarded-proto`
- Fallback uses request URL host/protocol.
- Optional override via `API_URL`.
- Header trust is controlled by `TRUST_PROXY_HEADERS`:
  - Codespaces/reverse proxy: set `TRUST_PROXY_HEADERS=true`
  - local default: `TRUST_PROXY_HEADERS=false`

### Usually not needed on local/VPS
- Localhost URLs are valid locally.
- VPS has a stable domain and direct origin.

## 5. Legacy localhost image URLs in stored note content

### Codespaces issue
- Old notes may still contain `http://localhost:3001/uploads/...` in editor JSON content.

### Fix implemented
- Frontend normalizes legacy image URLs to `NEXT_PUBLIC_API_URL` before rendering/use:
  - [front/src/lib/utils.ts](front/src/lib/utils.ts)
  - [front/src/hooks/useNoteEditor.ts](front/src/hooks/useNoteEditor.ts)
  - [front/src/components/MainEditor.tsx](front/src/components/MainEditor.tsx)

### Usually not needed on local/VPS
- If notes were created with correct stable API URL from the start, no normalization is needed.

## 6. Practical Codespaces rule

Use one host consistently during testing.
- Prefer forwarded domains for both frontend and backend.
- Avoid mixing `localhost:*` and `*.app.github.dev` in the same browser session for auth/server actions flows.

## 8. Production-safe profile

Recommended for VPS/production:
- Frontend:
  - set `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS` to your exact public frontend domain(s)
  - do not rely on wildcard `*.app.github.dev`
- API:
  - set `CORS_ORIGIN` to exact frontend domain(s)
  - set `API_URL` to your canonical API public URL
  - set `TRUST_PROXY_HEADERS=true` only when traffic is behind a trusted proxy/load balancer

## 7. Restart reminders after config changes

In Codespaces, restart services after changing:
- Next config (`front/next.config.ts`)
- env files (`front/.env.local`, `api/.env`)
- backend URL-generation logic

Without restart, old process state can make troubleshooting confusing.

# NotesAides

NotesAides is a full-stack note app using Bun + Hono (API), Next.js (frontend), and PostgreSQL.

This README gives one setup flow for:
- Local development
- GitHub Codespaces development
- Production-safe deployment defaults

## Stack

- API: Bun, Hono, Drizzle
- Frontend: Next.js App Router, React
- Database: PostgreSQL

## Environment Files

Use these templates:
- [api/.env.example](api/.env.example)
- [front/.env.example](front/.env.example)

Create real env files before running:

```bash
cp api/.env.example api/.env
cp front/.env.example front/.env.local
```

If you run with docker-compose, keep the same values in:
- [api/.env.local](api/.env.local)
- [front/.env.local](front/.env.local)

## 1) Local Development (Recommended)

### Start database

```bash
docker-compose up -d db
```

### Run migrations

```bash
cd api
bun run db:generate
bun run db:push
```

### Start API

```bash
cd api
bun run dev
```

### Start Frontend

```bash
cd front
pnpm run dev
```

### URLs

- Frontend: http://localhost:3000
- API: http://localhost:3001

## 2) GitHub Codespaces

Set forwarded domains in env values.

Example frontend env:
- `NEXT_PUBLIC_API_URL=https://<codespace>-3001.app.github.dev`
- `NEXT_PUBLIC_WS_URL=wss://<codespace>-3001.app.github.dev/ws`

Example API env:
- `CORS_ORIGIN=https://<codespace>-3000.app.github.dev,https://<codespace>-3001.app.github.dev`
- `TRUST_PROXY_HEADERS=true`

Important rule:
- Use forwarded domains consistently during one session.
- Avoid mixing localhost and app.github.dev in the same auth/server-action flow.

## 3) Production-Safe Defaults

Use strict values in production.

### Frontend

- `NODE_ENV=production`
- `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS=https://your-frontend-domain.com`

Do not leave wildcard values like `*.app.github.dev` in production.

### API

- `NODE_ENV=production`
- `CORS_ORIGIN=https://your-frontend-domain.com`
- `API_URL=https://api.your-domain.com`
- `TRUST_PROXY_HEADERS=true` only when running behind a trusted reverse proxy/load balancer.

## 4) Security Notes

- Server Actions origin checks are strict in production and env-driven.
- CORS is env-driven; in production, keep it explicit and minimal.
- Upload URL generation can trust forwarded headers only when `TRUST_PROXY_HEADERS=true`.

## 5) Useful Commands

```bash
# API migrations
cd api && bun run db:generate && bun run db:push

# Frontend lint
cd front && npm run lint
```

## 6) Troubleshooting

- `Invalid Server Actions request`:
	Check `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS` and ensure origin/host consistency.
- Uploaded image file exists but does not render:
	Check `NEXT_PUBLIC_API_URL`, `API_URL`, and `TRUST_PROXY_HEADERS`.
- CORS blocked in browser:
	Check `CORS_ORIGIN` exact values.

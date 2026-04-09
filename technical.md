# NotesAides Technical Documentation

Last updated: 2026-04-09
Repository root: `Cluster/`

## 1. Project Reality Check

`NotesAides` is a monorepo full-stack note application with:
- A Bun + Hono API (`api/`)
- A Next.js 16 frontend (`front/`)
- A Rust->WASM image processing module (`image-wasm/`)
- Local Docker orchestration (`docker-compose.yml`)
- Kubernetes manifests for k3s deployment (`k3s/`)

The implementation currently focuses on authenticated note CRUD, soft-delete/trash, tags/folders organization, real-time sync notifications, and rich-text editing with image optimization/crop/rotate.

The `Prototype.md` describes a broader AI/vector-search vision. Most AI-specific features (LLM routing, semantic graph, vector DB, OCR cloud routing) are not yet implemented in the current codebase.

## 2. Monorepo and Build Layout

## 2.1 Workspace definition

Root `pnpm-workspace.yaml`:
- `api`
- `front`

Root `package.json` scripts:
- `dev`: `pnpm --filter '*' --parallel dev`
- `build`: `pnpm --filter '*' --parallel build`

## 2.2 Package managers/runtime used

- Backend runtime/tooling: Bun
- Frontend package manager: pnpm
- Rust crate manager/build: Cargo + `wasm-pack`
- ORM/migrations: Drizzle ORM + drizzle-kit

## 2.3 Important generated artifacts

- `api/uploads/` (runtime uploaded images, gitignored except `.gitkeep` policy)
- `front/.next/` (Next build output)
- `image-wasm/target/` (Rust build output)
- `image-wasm/pkg/` (WASM JS bindings required by frontend local dependency)

## 3. High-Level Architecture

```mermaid
flowchart LR
    UI[Next.js Frontend\nReact + TipTap + React Query] -->|local-first reads/writes| IDB[(IndexedDB)]
    UI -->|HTTP Bearer JWT sync| API[Hono API on Bun]
    UI -->|WebSocket token query| WS[/ws]
    API --> DB[(PostgreSQL)]
    WS --> API
    UI --> WASM[image-wasm package\nRust compiled to WASM]
    WASM --> UI
    API --> FS[(uploads/ static files)]
    API --> TAGS[(tags / folders / note_tags)]
```

Key runtime properties:
- Auth uses JWT bearer tokens (7-day expiry)
- Notes are user-scoped by `userId`
- Frontend note UX is local-first using IndexedDB
- API database remains the source of truth after sync
- Full note bodies and lightweight note summaries are stored separately in IndexedDB
- Note writes are queued in a persistent outbox and flushed in the background
- Notes can be grouped by folder and linked to multiple tags
- Deletion is soft by default (`deleted_at`), with restore and permanent-delete
- WebSocket broadcast events refresh or reconcile the local store
- Editor stores rich content as TipTap JSON in PostgreSQL JSONB
- Search uses `title`, extracted `content_text`, and JSON text fallback

## 4. Backend (`api/`) Deep Dive

## 4.1 Backend stack

- Framework: Hono
- Runtime: Bun
- DB client: `postgres` + Drizzle
- JWT: `hono/jwt`
- Password hashing: `Bun.password.hash/verify`

`api/package.json` scripts:
- `dev`: `bun run --watch src/index.ts`
- `start`: `bun run src/index.ts`
- `cleanup`: `bun run src/cleanup.ts`
- `db:generate`: `drizzle-kit generate`
- `db:push`: `drizzle-kit push`

## 4.2 Layered architecture

The backend uses a clean-ish layer split:
- `domain/`: interfaces and entities (`Note`, `User`, repository contracts)
- `application/`: use-cases (`CreateNote`, `UpdateNote`, auth, reset flows)
- `infrastructure/`: Drizzle repositories, DB config, websocket event bus
- `interface/`: HTTP routes (`routes.ts`, `authRoutes.ts`)
- `index.ts`: app composition + server bootstrap

## 4.3 HTTP routes and behavior

Base host defaults:
- API server: `http://localhost:3001` unless `PORT` overrides

### Public/auth routes (`/auth`)

`POST /auth/register`
- Input: `{ email, password }`
- Validates email format and minimum password length 8
- Rejects duplicate email
- Stores hashed password
- Response: created user fields excluding password hash

`POST /auth/login`
- Input: `{ email, password }`
- Verifies credentials
- Returns `{ token, user }`
- Token payload includes `sub`, `email`, `exp` (7 days)

`POST /auth/forget-password`
- Input: `{ email }`
- If user exists: generates reset token + 1h expiry in DB
- Always returns generic success message to avoid account enumeration
- Current route does not return token or send email

`POST /auth/reset-password`
- Input: `{ token, newPassword }`
- Validates token existence and expiry
- Updates password hash, clears reset token fields

### Protected note routes (`/notes`)

All `/notes/*` routes require JWT middleware.

`GET /notes`
- Returns non-deleted notes for authenticated user
- Ordered by newest `updatedAt`
- Accepts optional `tag` and `folder` filters

`GET /notes/:id`
- Returns note if owned and not soft-deleted
- `404` if missing

`POST /notes`
- Creates note with extracted `contentText`, optional `tags`, and optional `folderId`
- Accepts a client-provided `id` so local-first note creation can keep the same note identifier across IndexedDB and Postgres
- Emits websocket event `NOTE_CREATED`

`PATCH /notes/:id` and `PUT /notes/:id`
- Updates title/content and may also replace tags / assign folder
- Includes retry loop (up to 5 attempts with backoff) to handle race timing after create
- Emits `NOTE_UPDATED`

`DELETE /notes/:id`
- Soft delete (sets `deletedAt`)
- Emits `NOTE_DELETED`

`GET /notes/deleted`
- Returns soft-deleted notes
- Ordered by latest `deletedAt`

`POST /notes/:id/restore`
- Clears `deletedAt`
- Emits `NOTE_RESTORED`

`DELETE /notes/:id/permanent`
- Hard delete (row removal)
- Emits `NOTE_PERMANENTLY_DELETED`

`GET /notes/search?q=<query>`
- If empty query: returns all non-deleted notes
- Supports optional `tag` and `folder` filters
- Otherwise text search against `title`, `content_text`, and `content::text` using `ILIKE`

Additional note-organization routes:

`GET /notes/tags`
- Lists tags currently attached to non-deleted notes for the authenticated user

`POST /notes/:id/tags`
- Adds or reuses a normalized tag for the note
- Emits `NOTE_UPDATED`

`DELETE /notes/:id/tags/:tagId`
- Removes a tag from the note
- Emits `NOTE_UPDATED`

`GET /notes/folders`
- Lists folders owned by the authenticated user

`POST /notes/folders`
- Creates or reuses a normalized folder name

`PATCH /notes/:id/folder`
- Assigns or clears a folder on the note
- Emits `NOTE_UPDATED`

### Upload route

`POST /upload`
- Requires JWT middleware
- Multipart form with `file`
- Allowed MIME types: JPEG, PNG, WebP
- Max size: 10 MB
- Saves to `uploads/<uuid>.<ext>` via `Bun.write`
- Returns absolute URL using `API_URL` env fallback `http://localhost:3001`

Static serving:
- `app.use('/uploads/*', serveStatic({ root: './' }))`

## 4.4 WebSocket sync design

Endpoint:
- `GET /ws?token=<jwt>`

Flow:
1. Token is verified server-side.
2. Socket subscribes to channel `user_<userId>`.
3. HTTP mutations call `notifyChange(userId, type, noteId)`.
4. Event emitter listener publishes JSON message to matching user channel.

Event payload shape:
- `{ type, noteId }`

Frontend currently reacts by reconciling note changes into IndexedDB, then updating list/detail reads from local state.

## 4.5 Data model and persistence

Source of truth schema: `api/src/infrastructure/db/schema.ts`

### `users`
- `id` varchar(255) PK
- `email` unique not null
- `password_hash` not null
- `reset_token` nullable
- `reset_token_expiry` nullable timestamp
- `created_at` not null

### `notes`
- `id` varchar(255) PK
- `user_id` FK -> `users.id` with cascade delete
- `folder_id` FK -> `folders.id` with set-null delete behavior
- `title` not null
- `content` JSONB not null
- `content_text` text not null default `''`
- `created_at` not null
- `updated_at` not null
- `deleted_at` nullable timestamp (soft delete)

### `folders`
- `id` varchar(255) PK
- `user_id` FK -> `users.id` with cascade delete
- `name` not null
- `normalized_name` not null
- unique `(user_id, normalized_name)`

### `tags`
- `id` varchar(255) PK
- `user_id` FK -> `users.id` with cascade delete
- `name` not null
- `normalized_name` not null
- unique `(user_id, normalized_name)`

### `note_tags`
- composite PK: `(note_id, tag_id)`
- `note_id` FK -> `notes.id` with cascade delete
- `tag_id` FK -> `tags.id` with cascade delete

Migration history:
- `0000`: initial users + notes (`content` as text)
- `0001`: add `user_id` FK on notes
- `0002`: `content` -> JSONB + add `deleted_at`
- `0003`: add `tags` + `note_tags`
- `0004`: add `folders` + `notes.folder_id`

Important: committed Drizzle SQL history currently stops at `0004`, while the runtime schema in `schema.ts` also includes `notes.content_text` and `notes.updated_at`. That suggests the repository has relied on `db:push` for at least part of the schema evolution, so migration history is not fully self-describing yet.

## 4.6 Maintenance scripts

`src/cleanup.ts`
- Deletes notes with `deleted_at` older than 30 days
- Intended for cron/scheduled usage

`drop_notes.ts`
- Utility script to drop only `notes` table

## 4.7 Backend error-handling style

- Environment guard at startup for `JWT_SECRET`
- Route-level `try/catch` for auth endpoints
- Note routes return `404` for not-found cases
- Upload route validates file type/size and returns 4xx/5xx accordingly

## 5. Frontend (`front/`) Deep Dive

## 5.1 Frontend stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- React Query for client cache/fetching
- TipTap editor + extensions
- `image-wasm` local package for image processing
- Tailwind CSS v4 + custom CSS variables/theming

`front/package.json` scripts:
- `dev`: `next dev --turbo`
- `build`: `next build`
- `start`: `next start`

## 5.2 Route map

- `/` -> dashboard + note list + overview panel
- `/login` -> login form
- `/register` -> registration form
- `/notes/new` -> editor for creating note
- `/notes/[id]` -> editor for existing note
- `/notes/deleted` -> trash management page

App routes under `src/app/` use App Router page components and wrappers.

## 5.3 Global providers and auth model

`src/app/providers.tsx` wraps app with:
- `AuthProvider`
- `QueryClientProvider`
- `useSync` WebSocket hook

`AuthContext` behavior:
- Reads token from cookie first, then localStorage
- On login: stores token in localStorage + cookie (`token=...`)
- On logout: clears both and redirects to `/login`
- If no token on startup: redirects to `/login`

Important: token cookie is set from JS and is not `HttpOnly`, so server actions can read it but it is also script-accessible.

## 5.4 Data access patterns (local-first)

The primary note path is now local-first:

1. IndexedDB-backed repositories/services
- `src/lib/notes/localDb.ts` defines the browser database
- `src/lib/notes/localNotesRepository.ts` handles local note reads/writes
- `src/lib/notes/remoteNotesRepository.ts` handles remote sync calls
- `src/lib/notes/notesService.ts` orchestrates local-first reads, local writes, outbox flushes, and remote reconciliation

2. React hooks
- `src/hooks/useNotes.ts` reads note lists/search/deleted notes from IndexedDB first
- `src/hooks/useLocalFirstNote.ts` reads note detail from IndexedDB first
- Hooks fall back to API only when local data is missing or a refresh path decides remote bootstrap is needed

3. Server Actions
- `src/app/actions/notes.ts` still exists, but the live note CRUD path is no longer centered on server actions
- Current local-first note create/update/delete flows use client hooks + IndexedDB + background sync instead

Important note:
- The app still has server fallback for cold start, missing note detail, and eventual reconciliation
- The note interaction model is no longer “every edit hits the API directly”
- React Query is still present, but it is no longer the primary source of truth for note content

## 5.5 Frontend local persistence model

IndexedDB stores:
- `notes`: full note bodies for detail/editor usage
- `note_summaries`: lightweight records for list/search/deleted screens
- `mutations`: persistent outbox of pending note mutations
- `sync_meta`: timestamps/metadata for refresh policy

`note_summaries` exists specifically to reduce local resource usage:
- list views do not need full TipTap JSON
- search does not need to scan full note bodies
- UI cards can use precomputed `snippet` and `previewImage`

Summary fields include:
- `id`, `title`
- `snippet`
- `previewImage`
- `contentText`
- tags/folder metadata
- timestamps
- local sync state and sync error

## 5.6 Note UX flows

### Home (`/`)
- Loads note summaries using `useNotes`
- Optional search using local-first `useSearchNotes`
- Left sidebar + middle note list + right overview/stats panel
- List and overview use summary data rather than full note bodies
- Note list rendering is windowed to avoid rendering every row at once

### New note (`/notes/new`)
- Renders editor with `note={null}`
- Autosave creates the note locally first
- A client UUID is generated immediately
- The note is written to IndexedDB and queued in the outbox
- The route then transitions to `/notes/<id>` using the same client/server note id
- Background sync later persists the note to the API

### Existing note (`/notes/[id]`)
- Detail loads through a client-side local-first hook
- If the note exists locally, the editor opens from IndexedDB immediately
- If missing locally, the app falls back to API fetch for that note and stores it locally
- Updates are written locally first and enqueued for background sync
- Delete is local-first, then synced to the API

### Trash (`/notes/deleted`)
- Uses `useDeletedNotes`
- Restore and permanent delete are also local-first note mutations
- Supports empty-trash action by iterating current deleted notes

## 5.7 Real-time synchronization

`useSync` hook:
- Opens WebSocket at `${NEXT_PUBLIC_WS_URL}?token=<token>`
- Auto-reconnect with exponential backoff up to 30s
- Periodically flushes the local outbox and also flushes on reconnect/online events
- On note websocket events, fetches or reconciles affected notes into IndexedDB
- UI updates indirectly because list/detail hooks read from local state
- Tag/folder views are still more API-first than note content flows

This keeps multi-tab/multi-client views eventually consistent while preserving local-first UX.

## 5.8 Performance-oriented local data design

To reduce browser resource usage while keeping note UX fast:
- Full note bodies and lightweight summaries are stored separately
- List-like screens read `note_summaries` instead of full TipTap JSON
- Summary records include precomputed `snippet` and `previewImage`
- List rendering uses windowing so the DOM does not mount every note row at once
- Search currently runs over summaries rather than full note bodies

Current limitation:
- Local search is still summary-scan based rather than a dedicated browser-side index

## 5.9 Editor internals (TipTap)

Editor core lives in `useNoteEditor` + `MainEditor`.

Enabled extensions include:
- StarterKit (headings, lists, base rich text)
- TaskList + TaskItem
- Table, TableRow, TableCell, TableHeader
- TextAlign
- BubbleMenu
- Custom `ResizableImage` node view

Autosave behavior:
- Save timer: 1 second after edits/title changes
- Skip save if content is effectively empty
- Tracks pending save state to avoid overlapping requests
- Retries pending changes once previous save finishes
- Save status indicator states: `idle`, `saving`, `saved`, `optimizing`, `cropping`, `rotating`

## 5.10 Image workflow in editor

User can:
- Drop/paste image
- Upload image via toolbar
- Crop selected image
- Rotate selected image (90/180/270)

Pipeline:
1. Client optimizes/crops/rotates image using `image-wasm` functions.
2. Processed pixels are converted to WebP via canvas.
3. File uploaded to API `/upload` with bearer token.
4. Editor inserts returned URL with cache-busting timestamp query.

Special handling:
- HEIC/HEIF uploads are rejected client-side with alert.

## 5.11 Styling and theming

`globals.css` defines:
- CSS variables for light/dark palette
- Custom classes for Apple-like note UI
- Table, checklist, editor toolbar/status styling
- `paper-texture` background effect
- Custom scrollbar

Tailwind v4 is used with typography plugin and additional handcrafted CSS.

## 6. Rust WASM Module (`image-wasm/`)

## 6.1 Purpose

Provide fast local image processing in browser for:
- Resize
- Crop
- Rotate

## 6.2 Crate details

`Cargo.toml`:
- `crate-type = ["cdylib", "rlib"]`
- deps: `wasm-bindgen`, `js-sys`, `image` with `jpeg/png/webp` decoding enabled

`src/lib.rs` exports:
- `resize_image(image_data, max_width) -> ProcessedImage`
- `crop_image(image_data, x, y, width, height) -> ProcessedImage`
- `rotate_image(image_data, degrees) -> ProcessedImage`

`ProcessedImage` exposes:
- `width`, `height`
- `get_pixels()` returning RGBA bytes as `Uint8Array`

Frontend then encodes RGBA to WebP using browser canvas (`toBlob`) for output file creation.

## 6.3 Build/dependency coupling

Frontend depends on local path:
- `"image-wasm": "file:../image-wasm/pkg"`

`image-wasm/pkg` must exist (generated via `wasm-pack build`) before clean installs/builds that resolve this dependency.

## 7. Local Development and Containers

## 7.1 Recommended local workflow (from README)

1. Run DB in Docker: `docker-compose up -d db`
2. Run API locally in `api/`: `bun run dev`
3. Run frontend locally in `front/`: `pnpm run dev`
4. Apply schema updates in `api/`: `bun run db:generate && bun run db:push`

## 7.2 `docker-compose.yml`

Services:
- `db` (`postgres:15-alpine`) exposed as host `5433 -> container 5432`
- `api` build from `api/Dockerfile`, host `3001:3001`, depends on `db`
- `front` build from `front/Dockerfile`, host `3000:3000`

Volumes:
- Persistent postgres data volume `postgres_data`

## 7.3 Dockerfiles

`api/Dockerfile`:
- Base `oven/bun:1`
- `bun install`, copy source, expose `3001`, run `bun run start`

`front/Dockerfile`:
- Multi-stage:
  1. Build WASM package with `wasm-pack`
  2. Install workspace deps and run Next build
  3. Runtime stage runs standalone Next server (`node front/server.js`)

## 8. Kubernetes/k3s Deployment Manifests

Namespace:
- `my-app-project`

Security/config:
- Secret `db-secret` with `POSTGRES_PASSWORD`, `JWT_SECRET` (base64)
- ConfigMap `app-config` with DB host/name and `PORT`
- Ingress terminates TLS, but application-layer security headers are not configured in the API itself

Database:
- PVC `postgres-pvc` (1Gi)
- Postgres deployment + service `postgres-service`

Backend:
- Deployment `backend-hono`, replicas `2`
- Image: `barry303/cluster-api`
- Service: `backend-service` (port 80 -> container 3000)

Frontend:
- Deployment `frontend-nextjs`, replicas `3`
- Image: `barry303/cluster-front`
- Env points to production API/ws domains
- Service: `frontend-service` (port 80 -> container 3000)

Ingress/TLS:
- Traefik ingress with hosts:
  - `notesaides.app` -> frontend
  - `api.notesaides.app` -> backend
- cert-manager integration with `ClusterIssuer` (`letsencrypt-prod`)
- TLS secret: `notesaides-tls`

## 9. Environment Variable Matrix

## 9.1 Backend (`api/.env.local`)

- `JWT_SECRET` (required)
- `API_URL` (used to build upload URLs)
- `DATABASE_URL` (Postgres connection)
- `PORT` (optional, default 3001)

## 9.2 Frontend (`front/.env.local`)

- `NEXT_PUBLIC_API_URL` (REST endpoint base)
- `NEXT_PUBLIC_WS_URL` (WebSocket endpoint)

## 9.3 K8s overrides

- `DB_HOST`, `DB_NAME`, `PORT` from ConfigMap
- secret values injected from `db-secret`

## 10. Data Contracts

## 10.1 Note object

Primary shape used front-back:
- `id: string`
- `userId: string` (backend)
- `title: string`
- `content: JSONContent` (TipTap JSON)
- `contentText?: string`
- `tags?: Array<{ id, name, color? }>`
- `folderId?: string|null`
- `folder?: { id, name, color? } | null`
- `createdAt: Date|string`
- `updatedAt?: Date|string`
- `deletedAt?: Date|string|null`

## 10.2 Auth response

Login returns:
- `token: string`
- `user: { id, email, resetToken, resetTokenExpiry, createdAt }`

## 10.3 WebSocket event

Message body:
- `type`: e.g. `NOTE_CREATED`, `NOTE_UPDATED`, `NOTE_DELETED`, `NOTE_RESTORED`, `NOTE_PERMANENTLY_DELETED`
- `noteId?: string`

## 11. Current Technical Risks and Gaps

1. AI/vector-search roadmap not implemented yet.
- `Prototype.md` contains future architecture not present in code.

2. Password reset flow is incomplete for production.
- `forget-password` generates token but no outbound email integration.

3. Auth token storage uses JS-readable cookie + localStorage.
- Easier integration with server actions, but weaker against XSS than HttpOnly cookie session approaches.

4. No explicit transaction boundaries for multi-step note updates.
- Create/update flows may perform several DB writes (note row, tags, folder linkage) without `db.transaction(...)`, so partial success is possible if one step fails mid-flow.

5. Dual data-access model (server actions + client mutations) raises complexity.
- Functional, but harder to reason about consistency and tracing write paths.

6. Search is SQL `ILIKE` over `title`, `content_text`, and `content::text`.
- No full-text or vector index currently.

7. Missing explicit test suite.
- No unit/integration/e2e test folders or scripts detected in root/api/front package scripts.

8. WASM package generation dependency can break cold setup.
- Frontend depends on `image-wasm/pkg`, which is generated artifact.

9. Soft-delete cleanup is manual/scheduled externally.
- No in-repo scheduler orchestration provided.

10. Type/interface drift exists in some backend helper code.
- `notifyChange` type union in `api/src/infrastructure/websocket.ts` includes only create/update/delete, while routes emit restore/permanent-delete too.
- `InMemoryNoteRepository` does not implement all methods declared in `INoteRepository`.

11. Migration history is incomplete relative to the declared runtime schema.
- `schema.ts` includes `content_text` and `updated_at`, but the committed SQL migrations do not currently show when those columns were introduced.

12. API security headers are minimal.
- CORS is configured, but headers such as CSP, HSTS, `X-Frame-Options`, and `Referrer-Policy` are not set by application middleware.

13. Minor auth/reset flow implementation mismatches.
- `forget-password` stores generated token but does not log or return it (comment still mentions console behavior).
- Login page calls `login()` (which already redirects) and also directly pushes to `/`.

## 12. Operational Sequences

## 12.1 Note create/edit sequence

1. User types in TipTap editor.
2. `useNoteEditor` schedules autosave.
3. New note page calls server action `createNote`; existing note page calls `useUpdateNote` mutation.
4. API writes DB and emits websocket event.
5. Frontend `useSync` receives event and invalidates caches.
6. UI re-renders list/detail with latest state.

## 12.2 Image insertion sequence

1. User drops/selects image.
2. Client optimizes in WASM (`resize_image`) and canvas encodes WebP.
3. Frontend posts file to `/upload` with JWT.
4. API validates type/size, stores file, returns URL.
5. TipTap inserts image node with URL.
6. Subsequent editor autosave persists updated TipTap JSON content.

## 12.3 Cache invalidation sequence

```mermaid
sequenceDiagram
    participant Editor as Frontend editor
    participant API as Hono API
    participant WS as WebSocket channel
    participant RQ as React Query cache

    Editor->>API: PATCH /notes/:id
    API->>API: Persist note update
    API-->>Editor: Updated note JSON
    API->>WS: publish NOTE_UPDATED
    WS-->>RQ: invalidate ['notes']
    WS-->>RQ: invalidate ['note', id]
    RQ-->>Editor: Refetch or reuse surgically updated cache
```

## 13. Code & Logic

### 13.1 Transaction Management

Current state:
- The repository does not currently use explicit `db.transaction(...)` blocks in the note write paths.
- `CreateNoteUseCase` creates the note first, then adds tags in follow-up repository calls.
- `UpdateNoteUseCase` may update note fields, assign a folder, and add/remove tags as separate DB operations.

Practical implication:
- Most operations are simple and user-scoped, but multi-step writes are not atomic.
- A failure after the first successful write can leave the database in a partially updated state until the next retry or manual correction.

Recommendation:
- Wrap create/update flows that coordinate note row changes plus tag/folder mutations in a single transaction at the repository boundary.
- This becomes more important as metadata and side effects continue to expand.

### 13.2 Security Header

Current state:
- The API configures CORS with explicit origins, methods, headers, and credentials.
- TLS is expected to be handled by the ingress/reverse proxy in deployed environments.
- No dedicated middleware currently sets headers such as:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `X-Content-Type-Options`

Interpretation:
- The current setup is enough for local development and basic deployment, but it is not yet a hardened response-header strategy.
- Because auth tokens are readable from browser JavaScript today, XSS prevention matters more than usual.

Recommendation:
- Add one response-header middleware in `api/src/index.ts` or enforce equivalent headers at ingress level, then document the chosen source of truth.

### 13.3 Caching Strategy

The application uses a hybrid cache model:
- Server actions fetch note data with `cache: 'no-store'`, so server-rendered note reads do not rely on Next.js fetch caching.
- Server mutations call `revalidatePath(...)` for route-level refresh after writes.
- Client-side note lists/search/trash/tags/folders use React Query.
- WebSocket events trigger client cache invalidation for cross-tab and cross-session freshness.
- Some client updates are optimistic-ish or surgical, especially `useUpdateNote`, which patches cached note data before relying on a refetch fallback.

Current tradeoff:
- This strategy favors freshness and simplicity over aggressive caching.
- It works well for collaborative note edits, but the split between server-action cache revalidation and client-query invalidation increases mental overhead.

```mermaid
flowchart TD
    SA[Server Actions] -->|fetch cache: no-store| API[API]
    SA -->|revalidatePath| NEXT[Next.js route cache]
    UI[Client Components] -->|useQuery/useMutation| RQ[React Query]
    RQ --> API
    API --> WS[WebSocket events]
    WS -->|invalidateQueries| RQ
```

## 14. Workflow

### 14.1 Branching strategy

Repository reality:
- No branch policy, merge rule, or CI-enforced workflow is encoded in the repository itself.
- There is no visible GitHub Actions or branch-protection config in this codebase snapshot.

Recommended team workflow for this repo:
1. Branch from `main` using a short-lived feature/fix branch.
2. Keep schema and API/frontend contract changes in the same branch when they must ship together.
3. Regenerate Drizzle artifacts in the same branch as schema edits.
4. Merge small, reviewable changes instead of long-running branches, because frontend/server-action/API interactions drift quickly.

Suggested naming:
- `feature/<topic>`
- `fix/<topic>`
- `chore/<topic>`

### 14.2 Migration Workflow

Current workflow in this repository:
1. Edit Drizzle schema in `api/src/infrastructure/db/schema.ts`.
2. Run `bun run db:generate` to emit SQL into `api/drizzle/`.
3. Run `bun run db:push` to apply schema changes to the target database.

Observed caveat:
- The checked-in migration history does not fully explain the current runtime schema, so `db:push` has likely been used to advance schema state beyond the reviewed SQL files.

Recommended tightening:
1. Treat `schema.ts` and `api/drizzle/*.sql` as a pair that must change together.
2. Review generated SQL before applying it.
3. Prefer committing each logical schema change as its own migration file.
4. Use `db:push` carefully in shared or production-like environments because it can hide migration-history gaps.

```mermaid
flowchart LR
    SCHEMA[schema.ts change] --> GEN[bun run db:generate]
    GEN --> SQL[api/drizzle/*.sql]
    SQL --> REVIEW[Review SQL]
    REVIEW --> PUSH[bun run db:push]
    PUSH --> DB[(PostgreSQL)]
```

## 15. Diagrams

This document already includes a system architecture diagram, and the sections above now add focused diagrams for:
- cache invalidation flow
- hybrid caching strategy
- migration workflow

Additional diagram opportunities if the documentation grows further:
- auth login / token lifecycle
- note create/update path with tags and folders
- upload/image-processing pipeline split between WASM, canvas, API, and storage

## 16. Setup Commands Cheat Sheet

From repository root:

```bash
# Start local postgres container
docker-compose up -d db

# Backend dev
cd api
bun install
bun run db:generate
bun run db:push
bun run dev

# Frontend dev (new terminal)
cd front
pnpm install
pnpm run dev
```

WASM package generation (needed when `image-wasm/pkg` is missing):

```bash
cd image-wasm
wasm-pack build --release
```

k3s deploy:

```bash
kubectl apply -f k3s/
```

## 17. Recommended Next Engineering Steps

1. Implement proper email delivery for reset-password tokens.
2. Consolidate note writes through one strategy (server actions or client mutations) to reduce complexity.
3. Move auth to HttpOnly cookie session/JWT refresh pattern.
4. Add automated tests for auth, note lifecycle, and websocket sync.
5. Add DB indexes/full-text strategy and then vector layer when semantic search is introduced.
6. Add CI pipeline to build Rust WASM package and ensure `front` can install from generated artifacts.

## 18. File Responsibilities Index

This index maps the most important files to their runtime role.

### 15.1 Root

- `README.md`: local hybrid workflow (DB in Docker, app locally).
- `Prototype.md`: target-state product vision and AI-oriented roadmap.
- `docker-compose.yml`: local multi-service orchestration.
- `pnpm-workspace.yaml`: workspace package membership.
- `package.json`: monorepo convenience scripts.

### 15.2 API package (`api/`)

- `src/index.ts`: Hono app wiring, CORS, websocket endpoint, static uploads, `/upload`, Bun server startup.
- `src/interface/routes.ts`: authenticated note route handlers.
- `src/interface/authRoutes.ts`: register/login/forgot/reset auth handlers.
- `src/application/CreateNote.ts`: note creation use-case.
- `src/application/GetNote.ts`: read note use-case.
- `src/application/UpdateNote.ts`: note update use-case with retry loop.
- `src/application/DeleteNote.ts`: soft delete, restore, permanent delete use-cases.
- `src/application/RegisterUser.ts`: registration validation and user creation.
- `src/application/LoginUser.ts`: credential verification and JWT creation.
- `src/application/ForgetPassword.ts`: reset token generation and expiry assignment.
- `src/application/ResetPassword.ts`: reset token validation and password update.
- `src/domain/Note.ts`: `Note` entity contract and note repository interface.
- `src/domain/User.ts`: `User` entity contract and user repository interface.
- `src/infrastructure/DrizzleNoteRepository.ts`: DB implementation for note operations/search.
- `src/infrastructure/DrizzleUserRepository.ts`: DB implementation for user operations.
- `src/infrastructure/InMemoryNoteRepository.ts`: partial in-memory note repository (non-production, currently incomplete).
- `src/infrastructure/websocket.ts`: event emitter bridge from HTTP mutations to websocket publisher.
- `src/infrastructure/db/index.ts`: Drizzle/postgres connection setup.
- `src/infrastructure/db/schema.ts`: users/notes schema definition.
- `src/cleanup.ts`: retention cleanup script for old soft-deleted notes.
- `drop_notes.ts`: utility to drop `notes` table.
- `drizzle/*.sql`: schema migration history.
- `drizzle/meta/*`: drizzle metadata snapshots/journal.

### 15.3 Frontend package (`front/`)

- `src/app/layout.tsx`: root layout and font setup.
- `src/app/providers.tsx`: Auth + QueryClient + websocket sync provider chain.
- `src/app/page.tsx`: authenticated home page shell (sidebar/list/overview).
- `src/app/login/page.tsx`: login UI and `/auth/login` integration.
- `src/app/register/page.tsx`: registration UI and `/auth/register` integration.
- `src/app/actions/notes.ts`: server actions for note CRUD/search/deleted fetch with cookie token.
- `src/app/notes/new/page.tsx`: new-note route entry.
- `src/app/notes/new/EditorWrapper.tsx`: new-note page composition and save action.
- `src/app/notes/[id]/page.tsx`: server note fetch and not-found handling.
- `src/app/notes/[id]/EditorWrapper.tsx`: existing-note editor composition and update/delete wiring.
- `src/app/notes/deleted/page.tsx`: deleted-notes route entry.
- `src/app/notes/deleted/DeletedWrapper.tsx`: trash management view and actions.
- `src/components/MainEditor.tsx`: top-level editor UI shell and image action controls.
- `src/components/Sidebar.tsx`: navigation, search, new note, logout.
- `src/components/NoteList.tsx`: list rendering states and search-result mode.
- `src/components/NoteCard.tsx`: note list item rendering.
- `src/components/editor/EditorToolbar.tsx`: TipTap command toolbar.
- `src/components/editor/StatusBadge.tsx`: autosave/image-processing status display.
- `src/components/editor/ImageCropModal.tsx`: crop modal and pixel crop mapping.
- `src/components/editor/extensions/ResizableImage.ts`: custom TipTap image extension with width/height attrs.
- `src/components/editor/extensions/ImageResize.tsx`: React node view for draggable image resize handle.
- `src/hooks/useNoteEditor.ts`: editor setup, autosave, upload/crop/rotate workflow.
- `src/hooks/useNotes.ts`: React Query note hooks and mutations.
- `src/hooks/useSync.ts`: websocket connection/reconnect + cache invalidation.
- `src/contexts/AuthContext.tsx`: client auth token lifecycle and redirects.
- `src/lib/imageOptimizer.ts`: Rust WASM interop + canvas WebP encoding.
- `src/lib/types.ts`: shared frontend `Note` type.
- `src/lib/utils.ts`: date formatting, content text extraction, first-image extraction.
- `src/app/globals.css`: full visual system styles.

### 15.4 Rust WASM package (`image-wasm/`)

- `Cargo.toml`: crate metadata and feature selection.
- `src/lib.rs`: exported image processing functions and `ProcessedImage` bridge type.

### 15.5 Kubernetes manifests (`k3s/`)

- `00-namespace.yaml`: namespace creation.
- `01-security.yaml`: secret + config map.
- `02-database.yaml`: postgres PVC/deployment/service.
- `03-backend.yaml`: backend deployment/service, probes/resources.
- `04-frontend.yaml`: frontend deployment/service, probes/resources.
- `05-ingress.yaml`: host routing + TLS ingress config.
- `06-issuer.yaml`: cert-manager ACME ClusterIssuer.

---

This document describes the code that exists now in this repository, not only planned architecture goals.

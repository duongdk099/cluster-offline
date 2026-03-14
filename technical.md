# NotesAides Technical Documentation

Last updated: 2026-03-14
Repository root: `Cluster/`

## 1. Project Reality Check

`NotesAides` is a monorepo full-stack note application with:
- A Bun + Hono API (`api/`)
- A Next.js 16 frontend (`front/`)
- A Rust->WASM image processing module (`image-wasm/`)
- Local Docker orchestration (`docker-compose.yml`)
- Kubernetes manifests for k3s deployment (`k3s/`)

The implementation currently focuses on authenticated note CRUD, soft-delete/trash, real-time sync notifications, and rich-text editing with image optimization/crop/rotate.

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
    UI[Next.js Frontend\nReact + TipTap + React Query] -->|HTTP Bearer JWT| API[Hono API on Bun]
    UI -->|WebSocket token query| WS[/ws]
    API --> DB[(PostgreSQL)]
    WS --> API
    UI --> WASM[image-wasm package\nRust compiled to WASM]
    WASM --> UI
    API --> FS[(uploads/ static files)]
```

Key runtime properties:
- Auth uses JWT bearer tokens (7-day expiry)
- Notes are user-scoped by `userId`
- Deletion is soft by default (`deleted_at`), with restore and permanent-delete
- WebSocket broadcast events trigger frontend cache invalidation
- Editor stores rich content as TipTap JSON in PostgreSQL JSONB

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
- Ordered by newest `createdAt`

`GET /notes/:id`
- Returns note if owned and not soft-deleted
- `404` if missing

`POST /notes`
- Creates note with generated UUID and current timestamp
- Emits websocket event `NOTE_CREATED`

`PATCH /notes/:id` and `PUT /notes/:id`
- Updates title/content
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
- Otherwise text search against `title` and `content::text` using `ILIKE`

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

Frontend reacts by invalidating React Query caches.

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
- `title` not null
- `content` JSONB not null
- `created_at` not null
- `deleted_at` nullable timestamp (soft delete)

Migration history:
- `0000`: initial users + notes (`content` as text)
- `0001`: add `user_id` FK on notes
- `0002`: `content` -> JSONB + add `deleted_at`

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

## 5.4 Data access patterns (hybrid)

There are two active patterns:

1. Server Actions (`src/app/actions/notes.ts`)
- Uses `cookies()` to read `token`
- Performs authenticated fetches server-side
- Uses `revalidatePath`
- `createNote` redirects to `/notes/<id>` on success

2. Client hooks (`src/hooks/useNotes.ts`)
- Uses React Query with token from `AuthContext`
- Handles list/search/deleted queries and note mutations
- Mutations invalidate or surgically update caches

This mixed approach is functional but increases complexity because data can be changed via either server action or client mutation path.

## 5.5 Note UX flows

### Home (`/`)
- Loads all notes using `useNotes`
- Optional search using debounced sidebar input + `useSearchNotes`
- Left sidebar + middle note list + right overview/stats panel

### New note (`/notes/new`)
- Renders editor with `note={null}`
- Autosave triggers `createNote` server action
- On first successful save, redirect to actual note ID route

### Existing note (`/notes/[id]`)
- Server fetch via `getNote(id)` (server action)
- Client wrapper updates note through `useUpdateNote`
- Delete action calls server action `deleteNote` and redirects to `/`

### Trash (`/notes/deleted`)
- Uses `useDeletedNotes`
- Restore and permanent delete via client mutations
- Supports empty-trash action by iterating current deleted notes

## 5.6 Real-time synchronization

`useSync` hook:
- Opens WebSocket at `${NEXT_PUBLIC_WS_URL}?token=<token>`
- Auto-reconnect with exponential backoff up to 30s
- On note mutation events, invalidates:
  - `['notes']`
  - `['note', noteId]` when available

This keeps multi-tab/multi-client views eventually consistent.

## 5.7 Editor internals (TipTap)

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

## 5.8 Image workflow in editor

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

## 5.9 Styling and theming

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
- `createdAt: Date|string`
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

4. Dual data-access model (server actions + client mutations) raises complexity.
- Functional, but harder to reason about consistency and tracing write paths.

5. Search is SQL `ILIKE` over `title` and `content::text`.
- No full-text or vector index currently.

6. Missing explicit test suite.
- No unit/integration/e2e test folders or scripts detected in root/api/front package scripts.

7. WASM package generation dependency can break cold setup.
- Frontend depends on `image-wasm/pkg`, which is generated artifact.

8. Soft-delete cleanup is manual/scheduled externally.
- No in-repo scheduler orchestration provided.

9. Type/interface drift exists in some backend helper code.
- `notifyChange` type union in `api/src/infrastructure/websocket.ts` includes only create/update/delete, while routes emit restore/permanent-delete too.
- `InMemoryNoteRepository` does not implement all methods declared in `INoteRepository`.

10. Minor auth/reset flow implementation mismatches.
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

## 13. Setup Commands Cheat Sheet

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

## 14. Recommended Next Engineering Steps

1. Implement proper email delivery for reset-password tokens.
2. Consolidate note writes through one strategy (server actions or client mutations) to reduce complexity.
3. Move auth to HttpOnly cookie session/JWT refresh pattern.
4. Add automated tests for auth, note lifecycle, and websocket sync.
5. Add DB indexes/full-text strategy and then vector layer when semantic search is introduced.
6. Add CI pipeline to build Rust WASM package and ensure `front` can install from generated artifacts.

## 15. File Responsibilities Index

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
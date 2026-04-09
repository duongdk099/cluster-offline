# NotesAides Architecture

Last updated: 2026-04-09
Scope: Architecture-only view (system structure, runtime flows, data model, and deployment topology).

## 1. System Context

```mermaid
flowchart LR
    User[End User] --> Frontend[Next.js Frontend\nfront/]
    Frontend -->|local-first reads/writes| IndexedDB[(IndexedDB)]
    Frontend -->|HTTPS REST sync| API[Bun + Hono API\napi/]
    Frontend -->|WSS /ws| API
    API -->|SQL| Postgres[(PostgreSQL)]
    Frontend -->|WASM calls| Wasm[Rust WASM Image Engine\nimage-wasm/]
    API -->|Static files| Uploads[(uploads/)]
```

## 2. Monorepo Architecture

```mermaid
flowchart TB
    Root[Cluster Monorepo]

    Root --> Front[front/]
    Root --> Api[api/]
    Root --> Wasm[image-wasm/]
    Root --> K3s[k3s/]

    Front --> FrontApp[App Router pages]
    Front --> FrontHooks[Hooks: useNotes/useSync/useNoteEditor/useLocalFirstNote]
    Front --> FrontComponents[Editor + Sidebar + Summary List components]
    Front --> FrontLocal[IndexedDB: notes + note_summaries + mutations + sync_meta]
    Front --> FrontServices[Notes service + local/remote repositories]
    Front --> FrontActions[Server Actions still present, but no longer primary note CRUD path]

    Api --> ApiInterface[Interface: authRoutes + routes]
    Api --> ApiUseCases[Application: Create/Update/Delete/Login/...]
    Api --> ApiDomain[Domain: Note/User contracts]
    Api --> ApiInfra[Infrastructure: Drizzle repos + websocket + db]

    Wasm --> WasmLib[src/lib.rs]
    K3s --> K3sManifests[Namespace + Security + DB + Backend + Frontend + Ingress + Issuer]
```

## 3. Runtime Component Topology (Local Dev)

```mermaid
flowchart LR
    Browser[Browser]
    NextDev[Next.js Dev Server\nlocalhost:3000]
    ApiDev[Hono API\nlocalhost:3001]
    Db[Postgres Docker\nlocalhost:5433]
    Idb[(IndexedDB)]

    Browser --> NextDev
    Browser --> Idb
    Browser -->|background sync + fallback fetches| ApiDev
    NextDev -->|WS from useSync| ApiDev
    ApiDev --> Db
    ApiDev --> UploadDisk[(api/uploads)]
```

## 4. Authentication and Session Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (/login)
    participant API as API (/auth/login)
    participant AC as AuthContext

    U->>FE: Submit email/password
    FE->>API: POST /auth/login
    API-->>FE: { token, user }
    FE->>AC: login(token)
    AC->>AC: Save token in localStorage
    AC->>AC: Set token cookie (7d)
    AC-->>FE: Navigate to /
```

## 5. Local-First Note Edit and Auto-Save Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Editor as TipTap + useNoteEditor
    participant FE as Frontend Wrapper + notesService
    participant IDB as IndexedDB
    participant API as /notes endpoints
    participant DB as PostgreSQL

    U->>Editor: Type or change title/content
    Editor->>Editor: debounce autosave (1s)

    alt New note
        Editor->>FE: onSave(new data)
        FE->>IDB: create local note + enqueue create mutation
    else Existing note
        Editor->>FE: onSave(updated data)
        FE->>IDB: update local note + enqueue update mutation
    end

    FE-->>Editor: local UI updates immediately

    loop background sync
        FE->>API: POST/PATCH/DELETE queued mutation
        API->>DB: insert/update/delete notes row
        DB-->>API: success
        API-->>FE: authoritative note state
        FE->>IDB: reconcile local record
    end
```

## 6. Real-Time Sync and Local Reconciliation Flow

```mermaid
sequenceDiagram
    participant FE1 as Client A
    participant FE2 as Client B
    participant IDB1 as IndexedDB A
    participant IDB2 as IndexedDB B
    participant API as Hono + Bun WS
    participant Bus as wsEvents emitter

    FE1->>API: Connect /ws?token=JWT
    FE2->>API: Connect /ws?token=JWT
    API->>API: subscribe sockets to user_<id>

    FE1->>API: PATCH /notes/:id
    API->>Bus: notifyChange(userId, NOTE_UPDATED, noteId)
    Bus->>API: broadcast payload to user_<id>
    API-->>FE1: WS event NOTE_UPDATED
    API-->>FE2: WS event NOTE_UPDATED

    FE1->>API: fetch changed note if needed
    FE2->>API: fetch changed note if needed
    FE1->>IDB1: merge authoritative note
    FE2->>IDB2: merge authoritative note
    IDB1-->>FE1: local-first UI updates
    IDB2-->>FE2: local-first UI updates
```

## 7. Image Processing and Upload Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant Editor as Frontend Editor
    participant WASM as image-wasm
    participant Canvas as Browser Canvas
    participant API as /upload
    participant FS as uploads/

    U->>Editor: Drop/Paste/Select image
    Editor->>WASM: resize/crop/rotate bytes
    WASM-->>Editor: RGBA pixels + dimensions
    Editor->>Canvas: encode WebP blob/file
    Editor->>API: POST /upload (JWT + multipart)
    API->>FS: write file
    API-->>Editor: public URL
    Editor->>Editor: insert image node in TipTap content
```

## 8. Data Model (Logical)

```mermaid
erDiagram
    USERS ||--o{ NOTES : owns

    USERS {
        varchar id PK
        varchar email UK
        varchar password_hash
        varchar reset_token
        timestamp reset_token_expiry
        timestamp created_at
    }

    NOTES {
        varchar id PK
        varchar user_id FK
        varchar title
        jsonb content
        text content_text
        timestamp updated_at
        timestamp created_at
        timestamp deleted_at
    }
```

## 9. Deployment Topology (k3s)

```mermaid
flowchart TB
    Internet[Internet]
    Ingress[Traefik Ingress\nnotesaides.app\napi.notesaides.app]
    FrontSvc[frontend-service:80]
    BackSvc[backend-service:80]
    FrontPods[frontend-nextjs pods x3]
    BackPods[backend-hono pods x2]
    PgSvc[postgres-service:5432]
    PgPod[postgres pod x1 + PVC]
    CM[ConfigMap app-config]
    Sec[Secret db-secret]
    Cert[cert-manager ClusterIssuer\nletsencrypt-prod]

    Internet --> Ingress
    Ingress --> FrontSvc
    Ingress --> BackSvc

    FrontSvc --> FrontPods
    BackSvc --> BackPods
    BackPods --> PgSvc
    PgSvc --> PgPod

    CM --> BackPods
    Sec --> BackPods
    Sec --> PgPod
    Cert --> Ingress
```

## 10. Container Build Architecture

```mermaid
flowchart LR
    subgraph FrontDockerBuild[front/Dockerfile]
      R1[rust:alpine] --> W1[wasm-pack build -> image-wasm/pkg]
      N1[node:20-alpine builder] --> P1[pnpm install workspace deps]
      W1 --> P1
      P1 --> B1[next build standalone]
      B1 --> R2[node:20-alpine runner]
      R2 --> S1[node front/server.js]
    end

    subgraph ApiDockerBuild[api/Dockerfile]
      B2[oven/bun:1] --> I2[bun install]
      I2 --> S2[bun run start]
    end
```

## 11. Architecture Decisions (Current)

- Rich note content is persisted as JSONB, not HTML.
- Frontend note UX is local-first; IndexedDB is the primary runtime read/write store for notes.
- PostgreSQL remains the source of truth after sync.
- IndexedDB separates full note bodies from lightweight note summaries to reduce client resource usage.
- Note writes are persisted in a local outbox and flushed asynchronously.
- Server fallback is still retained for cold start, missing local note detail, and reconciliation paths.
- Soft-delete is first-class (`deleted_at`), with explicit restore/permanent-delete APIs.
- Real-time sync is event-driven via websocket broadcasts scoped per user.
- Image processing is done client-side through Rust WASM for responsiveness and server offload.
- React Query remains in use, but note content no longer treats it as the primary source of truth.
- Server actions still exist, but note CRUD no longer depends on them as the primary interaction path.

## 12. Known Architecture Gaps

- Planned AI/vector-search architecture in `Prototype.md` is not yet implemented.
- Local search is summary-based and still scans in browser memory; it is improved over full-note scans but not yet a dedicated search index.
- Local-first note sync does not yet implement revision-based conflict resolution.
- The current note list windowing is simple fixed-height windowing rather than a more advanced virtualized layout system.
- Tags/folders remain more API-first than note bodies and summaries.
- Password reset token generation has no email delivery pipeline.
- Auth token is JS-readable (cookie + localStorage), not HttpOnly-session based.
- Frontend depends on generated `image-wasm/pkg`; clean environment setup requires WASM build step.

## 13. Quick Navigation

- System entrypoint: `api/src/index.ts`
- Note routes: `api/src/interface/routes.ts`
- Auth routes: `api/src/interface/authRoutes.ts`
- DB schema: `api/src/infrastructure/db/schema.ts`
- Front providers: `front/src/app/providers.tsx`
- Local note DB: `front/src/lib/notes/localDb.ts`
- Notes service: `front/src/lib/notes/notesService.ts`
- Editor core: `front/src/hooks/useNoteEditor.ts`
- Local-first detail hook: `front/src/hooks/useLocalFirstNote.ts`
- Sync hook: `front/src/hooks/useSync.ts`
- WASM exports: `image-wasm/src/lib.rs`
- k3s ingress: `k3s/05-ingress.yaml`

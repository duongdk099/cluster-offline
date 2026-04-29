# NotesAides Architecture

Last updated: 2026-04-29
Scope: Architecture-only view (system structure, runtime flows, data model, and deployment topology).

## 1. System Context

```mermaid
flowchart LR
    User[End User] --> Frontend[Next.js Frontend\nfront/]
    Frontend -->|HTTPS REST| API[Bun + Hono API\napi/]
    Frontend -->|WSS /ws| API
    API -->|SQL| Postgres[(PostgreSQL)]
    Frontend -->|WASM calls| Wasm[Rust WASM Image Engine\nimage-wasm/]
    API -->|Static files| Uploads[(uploads/)]
    API -->|on-demand file conversion| FileIO[Import/Export\nMD/TXT/DOCX/PDF]
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
    Front --> FrontHooks[Hooks: useNotes/useSync/useNoteEditor]
    Front --> FrontComponents[Editor + Sidebar + List components]
    Front --> FrontActions[Server Actions: app/actions/notes.ts]

    Api --> ApiInterface[Interface: authRoutes + routes]
    Api --> ApiUseCases[Application: Create/Update/Delete/Login/...]
    Api --> ApiFileUseCases[Application: ImportNote/ExportNote\nimport/* + export/* converters]
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

    Browser --> NextDev
    Browser -->|optional direct API fetches from client hooks| ApiDev
    NextDev -->|server actions fetch| ApiDev
    NextDev -->|WS from useSync| ApiDev
    ApiDev --> Db
    ApiDev --> UploadDisk[(api/uploads)]
    ApiDev --> FileConverters[In-memory import/export converters]
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

## 5. Note Edit and Auto-Save Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Editor as TipTap + useNoteEditor
    participant FE as Frontend Wrapper
    participant API as /notes endpoints
    participant DB as PostgreSQL

    U->>Editor: Type or change title/content
    Editor->>Editor: debounce autosave (1s)

    alt New note
        Editor->>FE: onSave(new data)
        FE->>API: POST /notes
    else Existing note
        Editor->>FE: onSave(updated data)
        FE->>API: PATCH /notes/:id
    end

    API->>DB: insert/update notes row
    DB-->>API: success
    API-->>FE: updated note payload
```

## 6. Real-Time Sync Flow

```mermaid
sequenceDiagram
    participant FE1 as Client A
    participant FE2 as Client B
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

    FE1->>FE1: invalidate React Query caches
    FE2->>FE2: invalidate React Query caches
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

## 8. Note Import Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as POST /notes/import
    participant Import as ImportNoteUseCase
    participant Create as CreateNoteUseCase
    participant DB as PostgreSQL
    participant WS as WebSocket bus

    U->>FE: Select .md/.txt/.docx file
    FE->>API: multipart file + optional tags/folderId
    API->>Import: validate and convert bytes to TipTap JSON
    Import->>Create: create normal note
    Create->>DB: insert note row and metadata
    API->>WS: NOTE_CREATED
    API-->>FE: created note payload
```

Import is not a separate persistence model. Imported files are converted into normal notes and then stored in the existing `notes` table.

## 9. Note Export Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as GET /notes/:id/export/:format
    participant Export as ExportNoteUseCase
    participant DB as PostgreSQL

    FE->>API: Request md/pdf/docx export
    API->>Export: verify ownership and format
    Export->>DB: load current note
    Export->>Export: generate file in memory
    API-->>FE: attachment response
```

Exports are generated on demand. The API does not store generated Markdown/PDF/DOCX files in PostgreSQL or `uploads/`.

## 10. Data Model (Logical)

```mermaid
erDiagram
    USERS ||--o{ NOTES : owns
    USERS ||--o{ TAGS : owns
    USERS ||--o{ FOLDERS : owns
    NOTES ||--o{ NOTE_TAGS : has
    TAGS ||--o{ NOTE_TAGS : labels
    FOLDERS ||--o{ NOTES : groups

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
        varchar folder_id FK
        varchar title
        jsonb content
        text content_text
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    FOLDERS {
        varchar id PK
        varchar user_id FK
        varchar name
        varchar normalized_name
    }

    TAGS {
        varchar id PK
        varchar user_id FK
        varchar name
        varchar normalized_name
    }

    NOTE_TAGS {
        varchar note_id PK,FK
        varchar tag_id PK,FK
    }
```

## 11. Deployment Topology (k3s)

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

## 12. Container Build Architecture

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

## 13. Architecture Decisions (Current)

- Rich note content is persisted as JSONB, not HTML.
- Soft-delete is first-class (`deleted_at`), with explicit restore/permanent-delete APIs.
- Real-time sync is event-driven via websocket broadcasts scoped per user.
- Image processing is done client-side through Rust WASM for responsiveness and server offload.
- Import creates normal note records from uploaded Markdown, text, and DOCX files.
- Export is stateless and generated in memory for Markdown, PDF, and DOCX responses.
- Frontend uses both server actions and client-side mutations; this works but creates a dual-write-path architecture.

## 14. Known Architecture Gaps

- Planned AI/vector-search architecture in `Prototype.md` is not yet implemented.
- Password reset token generation has no email delivery pipeline.
- Auth token is JS-readable (cookie + localStorage), not HttpOnly-session based.
- Frontend depends on generated `image-wasm/pkg`; clean environment setup requires WASM build step.
- Import/export fidelity is practical rather than perfect: DOCX import extracts raw text, PDF export uses readable text layout, and Markdown conversion covers common editor structures.

## 15. Quick Navigation

- System entrypoint: `api/src/index.ts`
- Note routes: `api/src/interface/routes.ts`
- Auth routes: `api/src/interface/authRoutes.ts`
- DB schema: `api/src/infrastructure/db/schema.ts`
- Import use case: `api/src/application/ImportNote.ts`
- Export use case: `api/src/application/ExportNote.ts`
- Front providers: `front/src/app/providers.tsx`
- Editor core: `front/src/hooks/useNoteEditor.ts`
- Sync hook: `front/src/hooks/useSync.ts`
- WASM exports: `image-wasm/src/lib.rs`
- k3s ingress: `k3s/05-ingress.yaml`

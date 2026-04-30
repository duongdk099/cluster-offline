# NotesAides Frontend

Nuxt 3 frontend for the NotesAides app. It uses Vue 3, Pinia, TanStack Vue Query, TipTap Vue 3, Tailwind CSS 4, and the local `image-wasm` package for browser-side image transforms.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run preview
pnpm run lint
```

The dev server runs on [http://localhost:3000](http://localhost:3000).

## Environment

Create `front/.env.local` from `.env.example` and set:

```bash
NUXT_PUBLIC_API_URL=http://localhost:3001
NUXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

## Structure

- `pages/` contains the Nuxt routes.
- `components/` contains the sidebar, note list, editor, and TipTap node views.
- `composables/` contains Vue Query hooks, WebSocket sync, and editor state.
- `stores/auth.ts` stores the auth token in Pinia, localStorage, and a cookie.
- `services/notesService.ts` contains direct REST calls to the existing API contract.

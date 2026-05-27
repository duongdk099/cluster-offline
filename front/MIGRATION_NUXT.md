# Migration Next.js → Nuxt 3 — Plan détaillé

> **Objectif** : remplacer entièrement la stack front actuelle (Next.js 16 / React 19 / TanStack React Query / TipTap React) par une stack équivalente basée sur Nuxt 3 / Vue 3 / Pinia / TanStack Vue Query / TipTap Vue 3, **à iso-fonctionnalité**, sans introduire de nouvelles features (pas de LocalFirst, pas d'IndexedDB, pas d'évolution de l'architecture WebSocket existante au-delà du portage).
>
> **Stratégie** : remplacer le contenu du dossier `front/` (pas de `front-nuxt/` à côté). On garde le même chemin, le même port (3000), la même intégration `docker-compose`, le même contrat API.

---

## 🚦 STATUT MIGRATION (mis à jour)

> Audit mis à jour sur l'état du dossier `front/`. **Migration code terminée et buildable** : `pnpm install`, `NUXT_IGNORE_LOCK=1 pnpm run build` et `pnpm run lint` passent. Reste à valider manuellement l'API, le CRUD, le WebSocket et le build Docker complet.

### ✅ FAIT

#### Étape 1 — Bootstrap Nuxt
- [x] `app.vue`
- [x] `nuxt.config.ts`
- [x] `package.json` (deps Nuxt/Vue/Pinia/Vue Query/TipTap Vue 3 OK)
- [x] `tsconfig.json`
- [x] `eslint.config.mjs`
- [x] `layouts/default.vue`
- [x] `assets/css/main.css` (ex-globals.css)

#### Étape 2 — Auth
- [x] `stores/auth.ts`
- [x] `composables/useAuth.ts`
- [x] `plugins/auth.client.ts`
- [x] `middleware/auth.global.ts`

#### Étape 3 — Services + utils + Vue Query
- [x] `types/notes.ts`
- [x] `utils/notes.ts`
- [x] `utils/imageOptimizer.ts`
- [x] `services/notesService.ts`
- [x] `plugins/vue-query.ts`

#### Étape 4 — Composables
- [x] `composables/useNotes.ts`
- [x] `composables/useSync.ts`
- [x] `composables/useNoteEditor.ts`
- [x] `plugins/sync.client.ts`

#### Étape 6 — Composants Vue
- [x] `components/AppleStyleButton.vue`
- [x] `components/NoteCard.vue`
- [x] `components/NoteList.vue`
- [x] `components/NoteHeader.vue`
- [x] `components/Sidebar.vue`
- [x] `components/SidebarItemButton.vue` (extrait de Sidebar)

---

### ✅ TERMINÉ DEPUIS LA REPRISE

#### Étape 5 — Extension TipTap (BLOQUANT pour MainEditor)
- [x] `components/editor/extensions/ResizableImage.ts`
- [x] `components/editor/extensions/ImageResize.vue`

> **Instruction** :
> 1. Créer le dossier `components/editor/extensions/`.
> 2. `ResizableImage.ts` : copier `src/components/editor/extensions/ResizableImage.ts` puis remplacer `import { ReactNodeViewRenderer } from '@tiptap/react'` par `import { VueNodeViewRenderer } from '@tiptap/vue-3'` et `ReactNodeViewRenderer(ImageResize)` par `VueNodeViewRenderer(ImageResize)`.
> 3. `ImageResize.vue` : porter `src/components/editor/extensions/ImageResize.tsx` en SFC. Remplacer `NodeViewWrapper` / `NodeViewProps` (TipTap React) par les imports équivalents `import { NodeViewWrapper } from '@tiptap/vue-3'`. Convertir `useState` → `ref()`, `useEffect` → `watch`/`onMounted`, gestionnaires `onMouseDown` → `@mousedown`. Conserver la même UX (poignée bottom-right, ratio préservé, min 50 px).

#### Étape 6 (suite) — Composants éditeur
- [x] `components/editor/ToolbarButton.vue`
- [x] `components/editor/EditorToolbar.vue`
- [x] `components/editor/StatusBadge.vue`
- [x] `components/editor/ImageCropModal.vue`
- [x] `components/MainEditor.vue` ⚠️ **composant central**

> **Instructions** :
> 1. **`ToolbarButton.vue`** : SFC simple, props `icon` (composant Lucide via `<component :is="icon">` ou slot), `onClick` (`@click` emit), `active`, `title`. Reproduire les classes Tailwind exactement comme dans `src/components/editor/EditorToolbar.tsx` (lignes 20-36).
> 2. **`EditorToolbar.vue`** : prop `editor: Editor | null` (de `@tiptap/core`), prop `onAddImage` (emit). Reproduire les 5 boutons (CheckSquare, List, Table, Bold, Italic, Image). Logique `handleTableAction` identique.
> 3. **`StatusBadge.vue`** : props `status: SaveStatus`, `createdAt?`, `updatedAt?`. Importer `SaveStatus` depuis `composables/useNoteEditor.ts`. Logique d'affichage identique à `src/components/editor/StatusBadge.tsx`.
> 4. **`ImageCropModal.vue`** : remplacer `react-image-crop` par `vue-advanced-cropper`. Props `imageUrl`, emit `crop` / `cancel`. Adapter `handleApply` pour produire un `PixelCrop`-like `{ x, y, width, height, unit: 'px' }` depuis les `coordinates` retournées par `<Cropper>`. Si `vue-advanced-cropper` pose problème, fallback `vue-cropperjs` (voir §6 risque #3).
> 5. **`MainEditor.vue`** : assemble le tout. Props `note: Note | null | undefined`, `onSave`, `onDelete?`, `isPending`. Appelle `useNoteEditor({ note, onSave, isPending })`. Remplace `<BubbleMenu>` de `@tiptap/react/menus` par celui de `@tiptap/vue-3/menus` (ou via `@tiptap/extension-bubble-menu` directement). Remplace `<EditorContent>` de `@tiptap/react` par celui de `@tiptap/vue-3`. Remplace `useFolders()` (Vue Query). Reproduire fidèlement les sections : header (toolbar + status + actions), titre+métadata (folder+tags), bloc éditeur, modale crop, input file caché. Voir `src/components/MainEditor.tsx` (305 lignes).

#### Étape 7 — Pages
- [x] `pages/index.vue` (home)
- [x] `pages/login.vue`
- [x] `pages/register.vue`
- [x] `pages/notes/index.vue` (redirect → `/`)
- [x] `pages/notes/new.vue`
- [x] `pages/notes/[id].vue`
- [x] `pages/notes/deleted.vue`

> **Instructions** :
> 1. **`pages/login.vue`** : porter `src/app/login/page.tsx`. Remplacer `useState` → `ref()`, `useRouter` Next → `useRouter` Vue Router, `Link` → `<NuxtLink>`, `useAuth` → `useAuthStore`. Le formulaire fait `fetch('${apiUrl}/auth/login')` — récupérer `apiUrl` via `useRuntimeConfig().public.apiUrl`. Sur succès : `auth.login(token)` puis `await navigateTo('/')`.
> 2. **`pages/register.vue`** : même approche, fetch `/auth/register`, sur succès afficher message puis `navigateTo('/login')` après 2 s.
> 3. **`pages/index.vue`** (home) : porter `src/app/page.tsx` (370 lignes). Composant interne `NotesOverview` peut rester inline ou extrait dans `components/NotesOverview.vue`. Utiliser `useRoute()` pour `route.query.tag` / `route.query.folder` (au lieu de `useSearchParams`). `useNotes(filters)` et `useSearchNotes(query, filters)` déjà disponibles. Pas de `<Suspense>` à wrapper. La fonction `updateFilters` utilise `router.push({ query: { tag, folder } })`.
> 4. **`pages/notes/index.vue`** : `<script setup>defineNuxtRouteMiddleware(() => navigateTo('/'))</script>` ou simplement `<script setup>await navigateTo('/', { redirectCode: 308 })</script>`.
> 5. **`pages/notes/new.vue`** : porter `src/app/notes/new/EditorWrapper.tsx`. `useTransition` n'a pas d'équivalent direct → utiliser un `ref(false)` `isPending`. Sur save : appeler `notesService.createNote(token, data)` ; sur succès `navigateTo(\`/notes/\${id}\`)`. Layout identique : Sidebar + NoteList + MainEditor.
> 6. **`pages/notes/[id].vue`** : `const route = useRoute(); const id = route.params.id as string;`. Utiliser `useAsyncData('note-' + id, () => notesService.getNote(token, id))` ou `useQuery` si on veut le cache Vue Query. Sur 404 → `throw createError({ statusCode: 404 })`. Wrapper analogue à `EditorWrapper.tsx`. La mutation `useUpdateNote()` est déjà dans `composables/useNotes.ts`.
> 7. **`pages/notes/deleted.vue`** : porter `src/app/notes/deleted/DeletedWrapper.tsx`. `useDeletedNotes`, `useRestoreNote`, `usePermanentDeleteNote` déjà disponibles. `confirm()` natif identique.

#### Étape 8 — Docker
- [x] [front/Dockerfile](Dockerfile) — Nuxt/Nitro `.output`
- [x] [front/.env.local](.env.local) — variables `NUXT_PUBLIC_*`
- [x] [front/.env.example](.env.example) — variables `NUXT_PUBLIC_*`
- [x] [docker-compose.yml](../docker-compose.yml) racine — volumes `.nuxt` + `.output`

> **Instructions** :
> 1. **Dockerfile** : voir §4.16 du plan. Multistage avec build WASM (inchangé), build Nuxt (`pnpm run build` → `.output/`), runner copie `.output/` puis `node .output/server/index.mjs`. Variables `NEXT_PUBLIC_*` → `NUXT_PUBLIC_*`.
> 2. **.env.local / .env.example** : remplacer toutes les occurrences `NEXT_PUBLIC_API_URL` → `NUXT_PUBLIC_API_URL` et `NEXT_PUBLIC_WS_URL` → `NUXT_PUBLIC_WS_URL`. Supprimer `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS` (plus de Server Actions).
> 3. **docker-compose.yml** : dans le service `front`, remplacer le volume `- /usr/src/app/.next` par `- /usr/src/app/.nuxt` et `- /usr/src/app/.output`.

#### Étape 9 — Cleanup
- [x] Supprimer `front/src/` (entièrement)
- [x] Supprimer `front/.next/`
- [x] Supprimer `front/next.config.ts`
- [x] Supprimer `front/next-env.d.ts`
- [x] Supprimer `front/tsconfig.tsbuildinfo`
- [x] Supprimer `front/.next-dev.stderr.log` et `front/.next-dev.stdout.log`
- [x] Mettre à jour `front/README.md` (commandes Nuxt, structure)
- [x] Compléter `front/.gitignore` : ajouter `.nuxt/`, `.output/`, `.data/`, `.cache/` ; supprimer entrées Next
- [x] Régénérer `front/pnpm-lock.yaml` (`pnpm install` après suppression de l'ancien)

> **Instructions** :
> 1. Au shell : `rm -rf front/src front/.next front/next.config.ts front/next-env.d.ts front/tsconfig.tsbuildinfo front/.next-dev.*.log`.
> 2. Mettre à jour `.gitignore` : ajouter `.nuxt/`, `.output/`, `.data/`, `.cache/` ; retirer `.next/`.
> 3. Régénérer le lockfile : depuis la racine `cluster-offline/`, lancer `pnpm install` pour régler les nouvelles deps Nuxt.
> 4. README.md : mentionner `pnpm run dev` (toujours valide), structure Nuxt, variables `NUXT_PUBLIC_*`.

---

### 🎯 Ordre de travail recommandé

> Suivre cet ordre pour qu'à chaque étape, le projet reste **buildable**.

1. **Étape 5** (extensions TipTap) — sans elle, MainEditor ne compile pas.
2. **Étape 6** (composants éditeur, dans l'ordre) :
   1. `ToolbarButton.vue` (le plus simple)
   2. `EditorToolbar.vue` (utilise ToolbarButton)
   3. `StatusBadge.vue`
   4. `ImageCropModal.vue` (POC vue-advanced-cropper)
   5. `MainEditor.vue` (assemble tout)
3. **Étape 7** (pages, dans l'ordre) :
   1. `pages/login.vue`, `pages/register.vue` (test auth E2E)
   2. `pages/index.vue` (home — Sidebar + NoteList + NotesOverview)
   3. `pages/notes/new.vue`, `pages/notes/[id].vue` (tests éditeur)
   4. `pages/notes/deleted.vue`, `pages/notes/index.vue`
4. **Étape 8** (Docker) — uniquement quand l'app tourne en local.
5. **Étape 9** (cleanup) — en dernier, après validation manuelle complète.

### 🧪 Validation finale

Lancer dans l'ordre :
```bash
# Local
pnpm install
pnpm run dev          # → http://localhost:3000 doit servir l'app
pnpm run build        # → .output/ généré sans erreur
pnpm run lint         # → zéro erreur

# Docker
docker compose up --build front
```

Puis tester manuellement les **16 critères d'acceptation** du §7.

---

## 0. Inventaire de l'existant (état des lieux)

### 0.1. Pages Next (App Router)

| Route Next                  | Fichier source                                     | Type            | Notes                                                              |
| --------------------------- | -------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| `/`                         | `src/app/page.tsx`                                 | Client (Suspense) | Home + overview, utilise `useSearchParams` (`?tag=`, `?folder=`)  |
| `/login`                    | `src/app/login/page.tsx`                           | Client          | Formulaire login → API `/auth/login`                              |
| `/register`                 | `src/app/register/page.tsx`                        | Client          | Formulaire register → API `/auth/register`                        |
| `/notes`                    | `src/app/notes/page.tsx`                           | Server          | Redirige vers `/`                                                 |
| `/notes/new`                | `src/app/notes/new/page.tsx` + `EditorWrapper.tsx` | Client          | Crée une note (Server Action `createNote`)                        |
| `/notes/[id]`               | `src/app/notes/[id]/page.tsx` + `EditorWrapper.tsx`| Server + Client | SSR fetch via `getNote(id)`, puis client                          |
| `/notes/deleted`            | `src/app/notes/deleted/page.tsx` + `DeletedWrapper.tsx` | Client     | Liste corbeille + restore/permanent delete                        |
| Layout racine                | `src/app/layout.tsx` + `src/app/providers.tsx`     | Mixte           | Charge `Geist` font, monte `AuthProvider` + `QueryClientProvider` + `useSync()` |

### 0.2. Composants React

| Composant            | Fichier                                            | Dépendances clés                                                                            |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Sidebar`            | `src/components/Sidebar.tsx`                       | `lucide-react`, `next/link`, `usePathname`, `useRouter`, hooks `useFolders/useTags/useDeletedNotes/useCreateFolder/useAssignFolderToNote` |
| `NoteList`           | `src/components/NoteList.tsx`                      | `lucide-react` + `NoteCard`                                                                 |
| `NoteCard`           | `src/components/NoteCard.tsx`                      | `lib/utils` (formatRelativeTime, stripHtml, extractFirstImage)                              |
| `NoteHeader`         | `src/components/NoteHeader.tsx`                    | (simple, optionnel — non utilisé ailleurs apparemment)                                      |
| `MainEditor`         | `src/components/MainEditor.tsx`                    | TipTap React, `useNoteEditor`, `useFolders`, `EditorToolbar`, `StatusBadge`, `ImageCropModal` |
| `EditorToolbar` + `ToolbarButton` | `src/components/editor/EditorToolbar.tsx` | TipTap `Editor` type, `lucide-react`                                                       |
| `StatusBadge`        | `src/components/editor/StatusBadge.tsx`            | type `SaveStatus` de `useNoteEditor`                                                        |
| `ImageCropModal`     | `src/components/editor/ImageCropModal.tsx`         | `react-image-crop`                                                                          |
| `AppleStyleButton`   | `src/components/AppleStyleButton.tsx`              | (utilitaire, peu utilisé)                                                                   |
| `ResizableImage`     | `src/components/editor/extensions/ResizableImage.ts` | TipTap extension qui `extend(TiptapImage)` + `ReactNodeViewRenderer(ImageResize)`         |
| `ImageResize`        | `src/components/editor/extensions/ImageResize.tsx` | `NodeViewWrapper`, `NodeViewProps` (TipTap React)                                           |

### 0.3. Hooks React (à transformer en composables Vue)

| Hook                          | Fichier                          | Dépendances React                                    | Composable Vue cible              |
| ----------------------------- | -------------------------------- | ---------------------------------------------------- | --------------------------------- |
| `useNotes` + `useTags` + `useFolders` + `useSearchNotes` + `useDeletedNotes` + `useCreateNote` + `useUpdateNote` + `useDeleteNote` + `useRestoreNote` + `usePermanentDeleteNote` + `useAddTagToNote` + `useRemoveTagFromNote` + `useCreateFolder` + `useAssignFolderToNote` | `src/hooks/useNotes.ts` | `@tanstack/react-query` (`useQuery`/`useMutation`) | `composables/useNotes.ts` (Vue Query) |
| `useSync`                     | `src/hooks/useSync.ts`           | `useEffect`, `useRef`, `useQueryClient`, `useAuth`   | `composables/useSync.ts`          |
| `useNoteEditor`               | `src/hooks/useNoteEditor.ts`     | `@tiptap/react` (`useEditor`), refs, callbacks       | `composables/useNoteEditor.ts`    |

### 0.4. Contexts / Providers

| Élément              | Fichier                                  | Cible Nuxt                                                  |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `AuthProvider/useAuth` | `src/contexts/AuthContext.tsx`         | Pinia store `stores/auth.ts` + middleware `middleware/auth.ts` |
| `Providers` (root)   | `src/app/providers.tsx`                  | Plugins Nuxt (`plugins/vue-query.ts`, `plugins/sync.client.ts`) + Pinia auto |
| Server Actions       | `src/app/actions/notes.ts`               | Service pur TS `services/notesService.ts` (appel client direct via `$fetch`/fetch — voir §3.2) |

### 0.5. Lib / utils (portage **direct**, pur TS, aucune dépendance React/Next)

| Fichier                       | Action                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/types.ts`            | **Copie 1:1** dans `types/notes.ts` (types TS purs)                                                                 |
| `src/lib/utils.ts`            | **Copie quasi 1:1** dans `utils/notes.ts`. Seul `process.env.NEXT_PUBLIC_API_URL` → `useRuntimeConfig().public.apiUrl` (à wrapper différemment, voir §4) |
| `src/lib/imageOptimizer.ts`   | **Copie 1:1** dans `utils/imageOptimizer.ts` — code 100 % browser-side, indépendant de React/Next                   |

### 0.6. Configuration & infra

| Fichier                       | Action                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `package.json`                | Réécrit (deps Vue/Nuxt, scripts, conserve `image-wasm` workspace-link)                                              |
| `next.config.ts`              | Supprimé → `nuxt.config.ts`                                                                                         |
| `next-env.d.ts`               | Supprimé                                                                                                            |
| `tsconfig.json`               | Réécrit pour Nuxt (extends `./.nuxt/tsconfig.json`)                                                                |
| `eslint.config.mjs`           | Réécrit pour `eslint-plugin-vue` + `@nuxt/eslint`                                                                   |
| `postcss.config.mjs`          | Conservé tel quel (Tailwind v4 PostCSS plugin)                                                                      |
| `src/app/globals.css`         | Déplacé en `assets/css/main.css`. Contenu Tailwind v4 (`@import "tailwindcss"`) et toutes les classes utilitaires custom (520 lignes) → **conservé tel quel** |
| `Dockerfile`                  | Réécrit (build target `node` Nuxt, sortie `.output/`, `node .output/server/index.mjs`) |
| `.dockerignore`, `.env.example`, `.env.local` | Variables renommées (`NEXT_PUBLIC_*` → `NUXT_PUBLIC_*`)                                            |
| `docker-compose.yml` (racine) | Mis à jour si commande `pnpm run dev` change (Nuxt aussi `pnpm run dev`, donc compatible — mais env vars renommées) |

### 0.7. Dépendances installées dans `package.json` actuel

```
@tailwindcss/typography ^0.5.19
@tanstack/react-query   ^5.90.21
@tiptap/core            ^3.20.0
@tiptap/extension-bubble-menu, image, table, table-cell, table-header, table-row, task-item, task-list, text-align ^3.20.0
@tiptap/pm              ^3.20.0
@tiptap/react           ^3.20.0
@tiptap/starter-kit     ^3.20.0
lucide-react            ^0.575.0
next                    16.1.6
image-wasm              file:../image-wasm/pkg
react / react-dom       19.2.3
react-image-crop        ^11.0.10

(dev) tailwindcss ^4, @tailwindcss/postcss ^4, eslint-config-next, typescript ^5
```

---

## 1. Stack cible

| Côté Next                          | Équivalent Nuxt retenu                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| Next.js 16 (App Router)            | **Nuxt 3.13+** (sortie node-server `.output/`)                        |
| React 19                           | **Vue 3.5+** (composition API, `<script setup>`)                      |
| TanStack React Query 5             | **TanStack Vue Query 5** (`@tanstack/vue-query`)                      |
| TipTap React                       | **TipTap Vue 3** (`@tiptap/vue-3`)                                    |
| `lucide-react`                     | **`lucide-vue-next`**                                                 |
| `react-image-crop`                 | **`vue-advanced-cropper`** *(remplaçant Vue le plus stable)* — voir §6 si reportage trop lourd, fallback `vue-cropperjs` |
| Server Actions Next + `revalidatePath` + `redirect` + `cookies()` | Appels client direct + Pinia store auth + Vue Router `navigateTo` (voir §3.2) |
| AuthContext (React Context)        | **Pinia store `useAuthStore()`** + plugin client-only de bootstrap    |
| `useSearchParams` / `useRouter`    | `useRoute()` / `useRouter()` (Vue Router 4)                          |
| `next/link`                        | `<NuxtLink>`                                                          |
| `next/font/google` (Geist)         | **`@nuxtjs/google-fonts`** ou import CSS direct (voir §4.4)           |
| Tailwind CSS 4 (PostCSS plugin)    | **Identique** : Tailwind v4 + `@tailwindcss/postcss` (Nuxt sans module spécial, juste PostCSS) |
| `next/image` *(non utilisé activement)* | `<NuxtImg>` (module `@nuxt/image`) si besoin, sinon `<img>`     |

> ⚠️ Tailwind v4 ne nécessite **pas** `@nuxtjs/tailwindcss` (qui est encore sur v3). On utilise le plugin PostCSS officiel directement, comme c'est déjà le cas dans le projet Next.

---

## 2. Arborescence cible (post-migration)

```
front/
├── .dockerignore
├── .env.example                   # variables NUXT_PUBLIC_* renommées
├── .env.local                     # idem
├── .gitignore                     # + .nuxt/ + .output/
├── Dockerfile                     # multistage, build Nuxt → .output
├── README.md                      # mis à jour
├── eslint.config.mjs              # eslint-plugin-vue + @nuxt/eslint
├── nuxt.config.ts                 # config Nuxt centrale
├── package.json                   # nouvelles deps
├── pnpm-lock.yaml                 # régénéré
├── pnpm-workspace.yaml            # conservé (sharp, unrs-resolver)
├── postcss.config.mjs             # conservé (Tailwind v4)
├── tsconfig.json                  # extends .nuxt/tsconfig.json
│
├── public/
│   └── (assets statiques, identique)
│
├── assets/
│   └── css/
│       └── main.css               # ex-globals.css (Tailwind + 520 lignes custom)
│
├── app.vue                        # racine Nuxt (<NuxtPage/>) — équivalent layout.tsx
│
├── layouts/
│   └── default.vue                # remplace l'ancien layout
│
├── pages/
│   ├── index.vue                  # ex-app/page.tsx (home + overview)
│   ├── login.vue                  # ex-app/login/page.tsx
│   ├── register.vue               # ex-app/register/page.tsx
│   └── notes/
│       ├── index.vue              # redirige vers /  (definePageMeta + middleware ou navigateTo)
│       ├── new.vue                # ex-app/notes/new
│       ├── deleted.vue            # ex-app/notes/deleted
│       └── [id].vue               # ex-app/notes/[id]
│
├── components/
│   ├── Sidebar.vue
│   ├── NoteList.vue
│   ├── NoteCard.vue
│   ├── NoteHeader.vue             # (si conservé)
│   ├── MainEditor.vue
│   ├── AppleStyleButton.vue
│   └── editor/
│       ├── EditorToolbar.vue      # exporte ToolbarButton.vue séparé
│       ├── ToolbarButton.vue
│       ├── StatusBadge.vue
│       ├── ImageCropModal.vue
│       └── extensions/
│           ├── ResizableImage.ts  # TipTap extension (pure TS) — refactor pour utiliser VueNodeViewRenderer
│           └── ImageResize.vue    # NodeView Vue (remplace ImageResize.tsx)
│
├── composables/
│   ├── useAuth.ts                 # wrapper léger autour du store Pinia (compat avec ancien `useAuth()`)
│   ├── useNotes.ts                # toutes les queries/mutations notes (vue-query)
│   ├── useTags.ts                 # ou regroupé dans useNotes.ts
│   ├── useFolders.ts              # idem
│   ├── useSync.ts                 # WebSocket + invalidation vue-query
│   └── useNoteEditor.ts           # TipTap Vue + autosave + tags/folder/upload/crop/rotate
│
├── stores/
│   └── auth.ts                    # Pinia : { token, login(), logout() }
│
├── middleware/
│   └── auth.ts                    # global / appliqué aux pages privées
│
├── plugins/
│   ├── vue-query.ts               # installe VueQueryPlugin avec QueryClient SSR-safe
│   └── sync.client.ts             # bootstrap useSync() au mount client (équivalent SyncProvider)
│
├── services/
│   └── notesService.ts            # appels REST purs (équivalent ex-actions/notes.ts, sans 'use server')
│
├── types/
│   └── notes.ts                   # types Note, NoteTag, NoteFolder
│
└── utils/
    ├── notes.ts                   # formatRelativeTime, stripHtml, extractFirstImage, normalizeUploadedImageUrl
    └── imageOptimizer.ts          # WASM (1:1)
```

---

## 3. Décisions d'architecture clés

### 3.1. Auth : Pinia plutôt que Vue provide/inject

- Store `useAuthStore()` :
  - state : `token: string | null`
  - actions : `bootstrap()` (lit cookie/localStorage au montage client), `login(token)`, `logout()`
- **Remplacement direct** de `AuthContext` :
  - `const { token, login, logout } = useAuthStore()` côté client (Pinia gère réactivité + SSR-safety).
  - On garde un composable `useAuth()` ultra-fin (`return useAuthStore()`) pour minimiser le diff dans les composants migrés.
- Bootstrap : plugin `plugins/auth.client.ts` qui appelle `bootstrap()` une seule fois au démarrage côté client (équivalent `useEffect` dans `AuthProvider`).
- **Pas de redirect côté serveur** : `useRouter().push('/login')` se fait dans le middleware client `middleware/auth.global.ts` ou local, **uniquement après bootstrap**.

### 3.2. Server Actions Next → appels client (décision)

L'utilisateur a choisi : **« replace the existing function in this project »** → on remplace par des **appels client direct** (pas de route handlers Nitro côté Nuxt). C'est le chemin le plus court et iso-fonctionnel : le projet n'utilisait les Server Actions que comme proxy avec injection de cookie token.

| Server Action existante       | Remplacement Nuxt                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `createNote(data)`            | `notesService.createNote(token, data)` puis `navigateTo('/notes/' + id)` côté page |
| `updateNote(id, data)`        | `notesService.updateNote(token, id, data)` (déjà utilisé via mutation vue-query)   |
| `deleteNote(id)`              | `notesService.deleteNote(token, id)` (idem mutation vue-query)                     |
| `restoreNote(id)`             | `notesService.restoreNote(token, id)`                                              |
| `permanentDeleteNote(id)`     | `notesService.permanentDeleteNote(token, id)`                                      |
| `getNote(id)`                 | `notesService.getNote(token, id)` — appelé via `useAsyncData` côté `pages/notes/[id].vue` |
| `getNotes()` / `getDeletedNotes()` / `searchNotes()` | déjà couverts par les hooks vue-query existants                       |

> Conséquence : les pages qui faisaient du SSR strict (`/notes/[id]`) deviennent **rendues côté client** par défaut. Comme l'utilisateur doit être loggué pour y accéder, c'est cohérent.
> Si on veut garder la pré-récupération côté serveur pour `/notes/[id]`, on utilisera `useAsyncData` avec `$fetch` ; le token devra alors transiter via `useCookie('token')` (lisible côté serveur Nitro). On le fait **uniquement pour cette page** pour préserver le comportement actuel ; les autres pages restent client-only.

### 3.3. TanStack Vue Query — config SSR-safe

- Plugin `plugins/vue-query.ts` :
  - Crée un `QueryClient` au démarrage.
  - Hydrate avec `dehydrate` / `hydrate` côté SSR (utilise `nuxtApp.payload`).
  - Désactive `refetchOnWindowFocus` au besoin (à matcher avec config actuelle, qui est par défaut dans Next).
- Les composables `useNotes`/`useTags`/etc. utilisent `useQuery` / `useMutation` de `@tanstack/vue-query`. **API quasi identique** à React Query.
- Token reactif (`storeToRefs(authStore)`) → si token absent, `enabled: computed(() => !!token.value)` (équivalent de `enabled: !!token` actuel).

### 3.4. WebSocket (`useSync`) — portage direct

- `composables/useSync.ts` : `onMounted` + `onUnmounted` au lieu de `useEffect`.
- `watch(token, …)` au lieu de la dépendance React `[token, queryClient]`.
- `queryClient` injecté via `useQueryClient()` de `@tanstack/vue-query`.
- Backoff exponentiel et reconnexion identiques.
- **Bootstrap** dans `plugins/sync.client.ts` (Vue : remplaçant du `<SyncProvider>` qui montait `useSync()`).

### 3.5. TipTap Vue — `useNoteEditor`

- Remplace `useEditor` de `@tiptap/react` par `useEditor` de `@tiptap/vue-3`. **API très proche** (immediatelyRender, extensions, content, onUpdate, editorProps).
- L'extension `ResizableImage` :
  - Reste pure TS, mais remplace `ReactNodeViewRenderer(ImageResize)` par **`VueNodeViewRenderer(ImageResize)`** (importé depuis `@tiptap/vue-3`).
  - `ImageResize.tsx` → `ImageResize.vue` (NodeView Vue avec `<NodeViewWrapper>`).
- L'autosave debounce / refs / `triggerAutoSave` :
  - `useState` → `ref()` ; `useRef` valeur stable → `ref()` ou variable JS scope-local.
  - `useEffect([note?.id])` → `watch(() => props.note?.id, …)`.
  - Logique métier identique (debounce 1s, retry si pending, hide "Saved" après 2.5s).
- Composant `<EditorContent>` de `@tiptap/vue-3` ; `<BubbleMenu>` aussi disponible (`@tiptap/extension-bubble-menu` → composant Vue exposé par `@tiptap/vue-3/menus`, à confirmer dans la version 3.20).
- **Drop / paste handlers** dans `editorProps.handleDrop` / `handlePaste` : code identique (closure JS pure).

### 3.6. `lucide-vue-next`

- Remplace tous les imports `import { X } from 'lucide-react'` par `import { X } from 'lucide-vue-next'`.
- Usage dans Vue : `<X :size="16" />` au lieu de `<X size={16} />`. Quelques composants utilisent la prop `strokeWidth` qui s'écrit `:stroke-width="2.5"`.

### 3.7. `react-image-crop` → `vue-advanced-cropper`

- **Préféré** : `vue-advanced-cropper` (maintenu, support Vue 3, API `<Cropper>` similaire).
- Conséquences sur `ImageCropModal.vue` :
  - L'API attend `coordinates` plutôt que `pixelCrop` ; on adapte la fonction `handleApply` pour produire `{ x, y, width, height, unit: 'px' }` à partir des `coordinates` retournées par `vue-advanced-cropper`.
  - Le rendu de l'image et le calcul natural↔display est géré directement par le cropper Vue (pas besoin de scaler manuellement).
- **Fallback** si problème : on peut conserver `react-image-crop` impossible (DOM React-only) → réimplémenter un crop minimal en utilisant `vue-cropperjs` (wrapper de Cropper.js).

### 3.8. Pas de LocalFirst / IndexedDB / repositories

> L'utilisateur a confirmé : **« replace the existing function »**. Le code actuel n'a **pas** de couche `localDb` / `notesService` (il n'y a pas d'IndexedDB, pas de repository pattern). On ne crée rien de neuf : on porte uniquement ce qui existe.
>
> La phrase « LocalFirst + WebSocket + IndexedDB opérationnels » dans la description initiale n'est **pas applicable** : seul WebSocket existe, et il sera porté tel quel.

---

## 4. Mapping détaillé fichier-par-fichier

### 4.1. `package.json`

```jsonc
{
  "name": "front",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nuxt dev --port 3000",
    "build": "nuxt build",
    "start": "node .output/server/index.mjs",
    "preview": "nuxt preview",
    "generate": "nuxt generate",
    "lint": "eslint ."
  },
  "dependencies": {
    "@pinia/nuxt": "^0.5.5",
    "@tailwindcss/typography": "^0.5.19",
    "@tanstack/vue-query": "^5.90.0",
    "@tiptap/core": "^3.20.0",
    "@tiptap/extension-bubble-menu": "^3.20.0",
    "@tiptap/extension-image": "^3.20.0",
    "@tiptap/extension-table": "^3.20.0",
    "@tiptap/extension-table-cell": "^3.20.0",
    "@tiptap/extension-table-header": "^3.20.0",
    "@tiptap/extension-table-row": "^3.20.0",
    "@tiptap/extension-task-item": "^3.20.0",
    "@tiptap/extension-task-list": "^3.20.0",
    "@tiptap/extension-text-align": "^3.20.0",
    "@tiptap/pm": "^3.20.0",
    "@tiptap/starter-kit": "^3.20.0",
    "@tiptap/vue-3": "^3.20.0",
    "image-wasm": "file:../image-wasm/pkg",
    "lucide-vue-next": "^0.460.0",
    "nuxt": "^3.13.0",
    "pinia": "^2.2.0",
    "vue": "^3.5.0",
    "vue-advanced-cropper": "^2.8.9",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "@nuxt/eslint": "^0.5.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "eslint": "^9",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### 4.2. `nuxt.config.ts`

```ts
export default defineNuxtConfig({
  compatibilityDate: '2025-04-29',
  devtools: { enabled: true },
  ssr: true,
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  postcss: {
    plugins: { '@tailwindcss/postcss': {} },
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001',
      wsUrl:  process.env.NUXT_PUBLIC_WS_URL  || 'ws://localhost:3001/ws',
    },
  },
  vite: {
    // Tailwind v4 + WASM (image-wasm)
    optimizeDeps: { exclude: ['image-wasm'] },
    server: { fs: { allow: ['..'] } }, // accès aux pkg WASM du workspace
  },
  app: {
    head: {
      title: 'NotesAides',
      meta: [
        { name: 'description', content: 'A fast Notes app with Hono, Bun, and Nuxt.' },
      ],
    },
  },
  nitro: {
    // build node-server pour Docker
    preset: 'node-server',
  },
  typescript: { strict: true },
});
```

### 4.3. `tsconfig.json`

```json
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "strict": true
  }
}
```

### 4.4. Fonts (Geist)

- Option A (retenue) : module `@nuxtjs/google-fonts` ajouté en dev-dep avec
  ```ts
  modules: [..., '@nuxtjs/google-fonts'],
  googleFonts: { families: { Geist: true, 'Geist+Mono': true }, display: 'swap' },
  ```
- Option B (fallback simple) : ajouter `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` dans `app.head.link` du `nuxt.config.ts`.
- Les variables CSS `--font-geist-sans` / `--font-geist-mono` (utilisées dans `globals.css`) seront définies dans `assets/css/main.css` directement.

### 4.5. `assets/css/main.css`

- Copie **stricte** de `src/app/globals.css` (520 lignes).
- Aucune transformation de classe Tailwind nécessaire (Tailwind v4, syntaxe identique).
- Si `@apply` ou `@layer` utilisés, on garde tel quel (Tailwind v4 PostCSS les gère).

### 4.6. `services/notesService.ts`

> Remplace `src/app/actions/notes.ts`. **Plus de `'use server'`, plus de `cookies()`, plus de `revalidatePath`, plus de `redirect`**. Le token est passé en argument (récupéré côté appelant via `useAuthStore`).

```ts
import type { JSONContent } from '@tiptap/core';
import type { Note } from '~/types/notes';

export interface NoteData {
  title: string;
  content: JSONContent;
  tags?: string[];
  folderId?: string | null;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function apiUrl() {
  const config = useRuntimeConfig();
  return config.public.apiUrl as string;
}

function authHeaders(token: string | null): HeadersInit {
  if (!token) throw new Error('No auth token found');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// createNote, updateNote, deleteNote, restoreNote, permanentDeleteNote,
// getNote, getNotes, getDeletedNotes, searchNotes
// → mêmes signatures que les Server Actions existantes, retournent ServiceResult<T>.
// La redirection après createNote ne fait PAS partie du service : elle est faite par la page (navigateTo).
```

### 4.7. `stores/auth.ts`

```ts
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({ token: null as string | null, ready: false }),
  actions: {
    bootstrap() {
      if (import.meta.server) return;
      const cookieToken = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
      const stored = cookieToken || localStorage.getItem('token');
      if (stored) {
        this.token = stored;
        document.cookie = `token=${stored}; path=/; max-age=${7*24*60*60}`;
      }
      this.ready = true;
    },
    login(token: string) {
      this.token = token;
      localStorage.setItem('token', token);
      document.cookie = `token=${token}; path=/; max-age=${7*24*60*60}`;
    },
    logout() {
      this.token = null;
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; max-age=0';
    },
  },
});
```

### 4.8. `middleware/auth.global.ts`

```ts
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return; // attendre le client (le bootstrap n'a pas encore tourné)
  const auth = useAuthStore();
  if (!auth.ready) auth.bootstrap();
  const publicRoutes = ['/login', '/register'];
  if (!auth.token && !publicRoutes.includes(to.path)) {
    return navigateTo('/login');
  }
  if (auth.token && publicRoutes.includes(to.path)) {
    return navigateTo('/');
  }
});
```

### 4.9. `plugins/vue-query.ts`

```ts
import { VueQueryPlugin, QueryClient, hydrate, dehydrate } from '@tanstack/vue-query';

export default defineNuxtPlugin((nuxt) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 30 } },
  });

  nuxt.vueApp.use(VueQueryPlugin, { queryClient });

  if (import.meta.server) {
    nuxt.hooks.hook('app:rendered', () => {
      nuxt.payload.vueQueryState = dehydrate(queryClient);
    });
  }
  if (import.meta.client) {
    hydrate(queryClient, nuxt.payload.vueQueryState);
  }
});
```

### 4.10. `plugins/sync.client.ts`

```ts
export default defineNuxtPlugin(() => {
  // Charge le composable au démarrage client uniquement
  const { start } = useSync();
  start();
});
```

> Note : on transforme `useSync()` en composable qui expose `start()` / `stop()` plutôt qu'un effect "automatique" — Vue n'a pas l'équivalent direct du React Effect global. La déconnexion se fait via `onScopeDispose` ou explicitement.

### 4.11. `composables/useNotes.ts`

- Reproduit les **14 hooks existants** un par un, en remplaçant :
  - `useQuery` (React) → `useQuery` (Vue) avec clé reactive si filtre dynamique.
  - `useMutation` (React) → `useMutation` (Vue).
  - `useQueryClient` (React) → `useQueryClient` (Vue).
  - `useAuth()` → `const auth = useAuthStore(); const { token } = storeToRefs(auth);`
  - `enabled: !!token` → `enabled: computed(() => !!token.value)`.
- Listing (mêmes noms) :
  - `useNotes(filters)`, `useTags()`, `useFolders()`, `useSearchNotes(query, filters)`, `useDeletedNotes()`,
  - `useCreateNote()`, `useUpdateNote()`, `useDeleteNote()`, `useRestoreNote()`, `usePermanentDeleteNote()`,
  - `useAddTagToNote()`, `useRemoveTagFromNote()`,
  - `useCreateFolder()`, `useAssignFolderToNote()`.

### 4.12. `composables/useSync.ts`

- Logique : identique à `useSync.ts` actuel (backoff, parse JSON message, `invalidateQueries`).
- Différences :
  - `useEffect` → `onMounted` / `watch(token)`.
  - `useRef` → `let socket: WebSocket | null` + `let attempt = 0` (closure).
  - Dépendance externe `useAuth()` → `useAuthStore()`.
  - **Exposition** : `return { start, stop }` pour permettre au plugin client d'appeler `start()`.

### 4.13. `composables/useNoteEditor.ts`

- Recompose la même API publique que React :
  ```
  { editor, title, tags, tagInput, folderId, saveStatus,
    handleTitleChange, handleTagInputChange, handleAddTag, handleRemoveTag,
    handleFolderChange, handleFileUpload, handleCrop, handleRotate, setSaveStatus }
  ```
- État interne :
  - `useState` → `ref()`.
  - Refs JS pures (`titleRef`, `tagsRef`, `onSaveRef`, `isPendingRef`, `autoSaveTimerRef`, `editorRef`, etc.) → variables locales JS dans la closure du composable (Vue n'a pas besoin de "refs anti stale-closure" car `ref().value` est toujours à jour).
- TipTap :
  - `useEditor` de `@tiptap/vue-3` (signature : objet d'options + `() => deps` est implicite via `watch`).
  - Reconfiguration au changement de `note.id` : `watch(() => props.note?.id, () => { editor.value?.commands.setContent(...) })`.
- Hooks de cycle :
  - `onBeforeUnmount(() => editor.value?.destroy())`.
- Tout le métier (parseTagDraft, normalizeTagList, normalizeContentImageUrls, debounce 1s, retry pending, hide après 2.5s) : copié 1:1.

### 4.14. Pages

#### `pages/index.vue` — équivalent `app/page.tsx`

- `useRouter` / `useRoute` au lieu de `useRouter` / `useSearchParams` Next.
- Filtres `tag` / `folder` lus depuis `route.query.tag` / `route.query.folder` (refs).
- `<Suspense>` Next remplacé par le rendu Vue normal (pas besoin de wrapper).
- Composant interne `NotesOverview` peut être inline dans le template ou extrait en `components/NotesOverview.vue` (préférable pour clarté).

#### `pages/login.vue` / `pages/register.vue`

- Formulaire submit → `notesService.login` n'existe pas (l'auth a son propre endpoint). On garde un `fetch` direct vers `${apiUrl}/auth/login` (ou `/auth/register`), comme actuellement.
- À la réussite : `authStore.login(data.token)` puis `navigateTo('/')`.

#### `pages/notes/index.vue`

- Une simple `definePageMeta({ middleware: () => navigateTo('/', { redirectCode: 308 }) })` ou `<script setup>navigateTo('/')</script>`.

#### `pages/notes/[id].vue`

- `const route = useRoute(); const id = route.params.id as string;`
- Récupération initiale via `useAsyncData('note-' + id, () => notesService.getNote(authStore.token, id))` **ou** simplement laisser le composable `useNotes` gérer (préférable pour cohérence avec le reste). Si on choisit `useAsyncData`, attention à exposer le token serveur via `useCookie('token')` côté SSR.
- Affiche `<MainEditor :note="note" :is-pending="..." @save="..." @delete="..." />`.

#### `pages/notes/new.vue`

- Pas de SSR, `<MainEditor :note="null" :is-pending="..." @save="onSave" />`.
- `onSave` appelle `notesService.createNote()` puis `navigateTo('/notes/' + id)`.

#### `pages/notes/deleted.vue`

- Liste `useDeletedNotes()`, mutations `useRestoreNote` / `usePermanentDeleteNote`.
- `confirm()` natif identique.

### 4.15. Composants Vue

| Vue                         | Spécificités migration                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `Sidebar.vue`               | Props identiques (`onNewNote`, `onLogout`, `searchQuery`, `onSearchChange`, …) → en Vue : props + `defineEmits('newNote', 'logout', 'update:searchQuery', …)`. Drag-n-drop via `@dragover`, `@dragleave`, `@drop` standards (DOM events). `usePathname` / `useRouter` → `useRoute()` / `useRouter()`. |
| `NoteList.vue`              | Props : `notes`, `isLoading`, `isError`, `selectedId`, `onSelect`, `searchQuery`, `onClearSearch`. Slots de chargement / erreur identiques. |
| `NoteCard.vue`              | Props : `note`, `isActive`, `onClick`, `onDragStart` → en Vue, on émet `@click` et `@dragstart` (peuplés via setData côté parent ou directement dans le `dragstart` handler). |
| `NoteHeader.vue`            | Trivial, simple template avec emit `logout`.                                                       |
| `MainEditor.vue`            | Le plus gros composant. Props `note`, `onSave`, `onDelete`, `isPending`. Toute la logique éditeur passe par `useNoteEditor`. `<BubbleMenu>` du paquet `@tiptap/vue-3` à utiliser. `<input type="file" ref="fileInputRef">` + `fileInputRef.value?.click()`. |
| `EditorToolbar.vue` + `ToolbarButton.vue` | `ToolbarButton` extrait en SFC avec slot `default` ou prop `icon` (rendu via `<component :is="icon">`). Plus simple : prop `icon` qui est un composant Lucide passé en prop. |
| `StatusBadge.vue`           | Trivial.                                                                                           |
| `ImageCropModal.vue`        | Refactor pour `<Cropper>` de `vue-advanced-cropper`. `imgSize` / `crop` / `completedCrop` → refs Vue. |
| `AppleStyleButton.vue`      | Trivial (button stylé).                                                                            |
| `editor/extensions/ResizableImage.ts` | Remplace `ReactNodeViewRenderer(ImageResize)` par `VueNodeViewRenderer(ImageResize)`. |
| `editor/extensions/ImageResize.vue` | NodeView Vue : `defineProps<{ node: any; updateAttributes: (attrs: any) => void; selected: boolean }>()` + `<NodeViewWrapper>`. Listeners `mousedown` / `mousemove` / `mouseup` via méthodes JS. |

### 4.16. `Dockerfile` (réécriture)

```dockerfile
# Stage 1 : Build WASM (inchangé)
FROM rust:alpine AS wasm-builder
WORKDIR /image-wasm
RUN apk add --no-cache wasm-pack
COPY ./image-wasm .
RUN wasm-pack build --release

# Stage 2 : Build Nuxt
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

# Stage 3 : Runner Nitro node-server
FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Sortie Nitro : .output/ est self-contained
COPY --from=builder /usr/src/app/front/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

> ⚠️ Le `.output/` Nitro embarque déjà ses dépendances (pas besoin de `node_modules` à part, contrairement à Next standalone qui copiait `front/server.js`).

### 4.17. `docker-compose.yml` racine

- `front` service : commande `pnpm run dev` reste compatible (Nuxt expose aussi `dev`).
- Volume `front/.next` → renommé `front/.nuxt` ET `front/.output`.
- Variables d'environnement renommées dans `front/.env.local` (clés `NUXT_PUBLIC_*`).

### 4.18. Variables d'environnement

| Ancienne (Next)                            | Nouvelle (Nuxt)                |
| ------------------------------------------ | ------------------------------ |
| `NEXT_PUBLIC_API_URL`                      | `NUXT_PUBLIC_API_URL`          |
| `NEXT_PUBLIC_WS_URL`                       | `NUXT_PUBLIC_WS_URL`           |
| `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS`      | **Supprimé** (plus de Server Actions) |
| `API_INTERNAL_URL`                         | **Supprimé** (utilisé seulement côté Server Actions) |

Mise à jour de `.env.example` et `.env.local`.

---

## 5. Plan d'exécution (ordre de migration)

> Chaque étape doit produire un build **qui compile**. Tester localement (`pnpm run dev`) à la fin de chaque étape.

### Étape 1 — Bootstrap Nuxt vide

1. Sauvegarder `front/Dockerfile`, `front/.env.example`, `front/.env.local`, `front/public/`, `front/README.md` (à conserver / réutiliser).
2. **Supprimer** `src/`, `next.config.ts`, `next-env.d.ts`, `.next/`, `tsconfig.tsbuildinfo`, `.next-dev.*.log`, `eslint.config.mjs`.
3. Créer `package.json` Nuxt (§4.1), `nuxt.config.ts` (§4.2), `tsconfig.json` (§4.3), `eslint.config.mjs` minimal Nuxt.
4. Créer `app.vue` minimal :
   ```vue
   <template><NuxtLayout><NuxtPage /></NuxtLayout></template>
   ```
5. Créer `layouts/default.vue` minimal (juste `<slot />`).
6. Créer `assets/css/main.css` (copie de l'ancien `globals.css`).
7. Renommer envs `NEXT_PUBLIC_*` → `NUXT_PUBLIC_*` dans `.env.local` et `.env.example`.
8. `pnpm install` puis `pnpm run dev` → page blanche servie sur :3000. **Critère** : pas d'erreur de build.

### Étape 2 — Auth + Pinia + middleware

1. `stores/auth.ts` (§4.7).
2. `composables/useAuth.ts` (wrapper léger).
3. `plugins/auth.client.ts` (bootstrap).
4. `middleware/auth.global.ts` (§4.8).
5. `pages/login.vue` + `pages/register.vue` (templates portés tels quels, formulaires fetch).
6. **Critère** : login fonctionne, redirige vers `/` après auth, `/login` ↔ `/` selon présence du token.

### Étape 3 — Vue Query + services + types/utils

1. `types/notes.ts` (copie 1:1).
2. `utils/notes.ts` (copie quasi 1:1, refactor des envs).
3. `utils/imageOptimizer.ts` (copie 1:1).
4. `services/notesService.ts` (§4.6).
5. `plugins/vue-query.ts` (§4.9).
6. **Critère** : `pnpm run build` passe.

### Étape 4 — Composables (useNotes, useSync, useNoteEditor)

1. `composables/useNotes.ts` (§4.11) — toutes les queries/mutations.
2. `composables/useSync.ts` (§4.12) + `plugins/sync.client.ts` (§4.10).
3. `composables/useNoteEditor.ts` (§4.13).
4. **Critère** : aucune utilisation dans une page encore, mais la compilation passe.

### Étape 5 — TipTap extension

1. `components/editor/extensions/ImageResize.vue`.
2. `components/editor/extensions/ResizableImage.ts` (avec `VueNodeViewRenderer`).
3. **Critère** : utilisé dans Étape 6, mais syntaxe / import correct.

### Étape 6 — Composants Vue

1. `components/AppleStyleButton.vue`.
2. `components/NoteCard.vue`.
3. `components/NoteList.vue`.
4. `components/Sidebar.vue` (le plus gros avec 14 hooks à brancher).
5. `components/editor/ToolbarButton.vue`.
6. `components/editor/EditorToolbar.vue`.
7. `components/editor/StatusBadge.vue`.
8. `components/editor/ImageCropModal.vue` (avec `vue-advanced-cropper`).
9. `components/MainEditor.vue` (assemble le tout).
10. (`NoteHeader.vue` si encore utilisé.)

### Étape 7 — Pages

1. `pages/index.vue` (home).
2. `pages/notes/[id].vue`.
3. `pages/notes/new.vue`.
4. `pages/notes/deleted.vue`.
5. `pages/notes/index.vue` (redirect).
6. **Critère** : navigation complète fonctionnelle, CRUD note OK, autosave OK, upload image OK, crop OK, rotate OK, WebSocket reconnect OK.

### Étape 8 — Dockerfile & docker-compose

1. Réécrire `front/Dockerfile` (§4.16).
2. Mettre à jour `docker-compose.yml` racine (volumes `.nuxt` / `.output`).
3. `docker compose up --build front` → service répond sur :3000.
4. **Critère** : build Docker complet, login → CRUD → WS sync vérifiés en container.

### Étape 9 — Cleanup & doc

1. `README.md` mis à jour : commandes Nuxt, structure projet, scripts.
2. Vérifier `.gitignore` (`.nuxt/`, `.output/`, supprimer `.next/`).
3. Supprimer artefacts `pnpm-lock.yaml` ancien et regénérer.
4. Run `pnpm run lint` (zero erreur).

---

## 6. Risques / points d'attention

| # | Risque                                                                                          | Mitigation                                                                                          |
| - | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1 | `image-wasm` (workspace link) chargement WASM côté Nuxt (Vite vs Turbopack)                     | Vite gère `?init` / dynamic import natif ; au pire ajouter `vite.optimizeDeps.exclude: ['image-wasm']` et un import dynamique au premier appel. Tester tôt en Étape 3. |
| 2 | TipTap `BubbleMenu` Vue : changement d'API entre versions (3.x mature en Vue 3 ?)               | Tester un POC TipTap Vue 3 dès l'Étape 5. Si BubbleMenu Vue indispo, fallback : afficher la barre conditionnellement via `editor.isActive('image')` dans un `<Transition>` positionné en absolute. |
| 3 | `react-image-crop` n'a pas d'équivalent Vue 1:1 → l'UX du crop peut différer                    | Choix par défaut `vue-advanced-cropper` (préview rond/carré, drag, resize). Si UX trop différente : `vue-cropperjs`. À démontrer sur Étape 6 #8. |
| 4 | Server Action `getNote(id)` rendait du SSR strict pour `/notes/[id]`                            | Pour préserver SSR, utiliser `useAsyncData` + `useCookie('token')` côté serveur (Nitro lit le cookie). Sinon accepter rendu client uniquement (acceptable car page protégée derrière auth). |
| 5 | `useSync` (WebSocket) côté client uniquement                                                    | Utiliser `plugins/sync.client.ts` (le suffixe `.client` garantit pas de SSR). Le composable doit gérer cleanup proprement (`onScopeDispose` ou exposition `stop()`). |
| 6 | Passage `lucide-react` → `lucide-vue-next` : props camelCase Vue                                  | Recherche/remplacement systématique. Quasi tous les composants n'utilisent que `size` / `strokeWidth` / `className` → `:size`, `:stroke-width`, `class`. |
| 7 | Tailwind v4 + `globals.css` (520 lignes) : `@apply`, classes custom (`paper-texture`, `app-shell`, `apple-table`, etc.) | Aucune transformation : Tailwind v4 PostCSS gère `@apply`/`@layer` exactement comme dans Next. |
| 8 | `pnpm-workspace.yaml` racine et `image-wasm`                                                     | Conserver tel quel. Le `package.json` Nuxt garde `"image-wasm": "file:../image-wasm/pkg"` (workspace fonctionne pareil). |
| 9 | `next/font` Geist remplacé : risque de FOUC                                                     | Soit `@nuxtjs/google-fonts` (preload + display swap), soit `<link>` direct dans `app.head.link`. Le rendu Apple-style dépend de Geist : le valider visuellement en Étape 1. |
| 10 | `useSearchParams` côté Next pouvait être SSR. `useRoute().query` côté Nuxt est SSR-safe.        | Aucun changement métier, juste API.                                                                 |
| 11 | Re-exports `@tiptap/react/menus` (BubbleMenu) ≠ `@tiptap/vue-3/menus`                           | Remplacement direct dans `MainEditor.vue` ; `@tiptap/extension-bubble-menu` reste dans la liste d'extensions.  |
| 12 | Pinia + Nuxt SSR : un store hydraté peut écraser le state client                                | `bootstrap()` n'est appelé que côté client (`if (import.meta.server) return`).                    |

---

## 7. Critères d'acceptation finaux

- [ ] **Build Docker** : `docker compose up --build front` démarre Nuxt sur :3000 sans erreur.
- [ ] **Auth** : `/login` → token stocké → redirige vers `/`. `/logout` → cookie/localStorage purgés → `/login`.
- [ ] **Inscription** : `/register` → succès → redirige `/login`.
- [ ] **Listing** : `/` affiche la liste des notes filtrable par tag/folder via querystring.
- [ ] **Recherche** : champ recherche → debounce → résultats filtrés.
- [ ] **Création** : `/notes/new` → édition → autosave après 1 s → redirige `/notes/[id]`.
- [ ] **Édition** : `/notes/[id]` → autosave debounce 1 s → status badge "Saving" / "Saved".
- [ ] **Tags** : ajout / suppression réactifs, persistés.
- [ ] **Folders** : création + drag-n-drop d'une note vers un folder.
- [ ] **Suppression** : note → corbeille → restore OK → permanent delete OK.
- [ ] **Upload image** : drag/paste/picker → optimisation WASM → upload → insertion dans l'éditeur.
- [ ] **Crop image** : modal → crop appliqué → image remplacée.
- [ ] **Rotate image** : 90° appliqué → image remplacée.
- [ ] **Resize image** (TipTap nodeview) : drag handle redimensionne.
- [ ] **WebSocket** : modification depuis un autre client → invalidation des queries → UI à jour.
- [ ] **Mobile** : sidebar responsive, mobile-tabbar, mobile-sheet fonctionnels.
- [x] **Lint** : `pnpm run lint` zéro erreur.
- [x] **Type-check** : `NUXT_IGNORE_LOCK=1 pnpm run build` zéro erreur TypeScript.

---

## 8. Liste fichiers à supprimer / remplacer

### Supprimés
```
front/.next/
front/.next-dev.stderr.log
front/.next-dev.stdout.log
front/next-env.d.ts
front/next.config.ts
front/tsconfig.tsbuildinfo
front/src/                                  ← intégralité
front/eslint.config.mjs                     ← réécrit (même nom)
front/tsconfig.json                         ← réécrit
front/package.json                          ← réécrit
front/Dockerfile                            ← réécrit
front/.env.example, .env.local              ← variables renommées
front/README.md                             ← réécrit
front/pnpm-lock.yaml                        ← régénéré
```

### Conservés
```
front/.dockerignore
front/.gitignore                            ← compléter avec .nuxt/, .output/
front/postcss.config.mjs
front/pnpm-workspace.yaml
front/public/                                (favicon, etc.)
```

### Créés (récapitulatif)
```
front/nuxt.config.ts
front/app.vue
front/layouts/default.vue
front/assets/css/main.css
front/types/notes.ts
front/utils/notes.ts
front/utils/imageOptimizer.ts
front/services/notesService.ts
front/stores/auth.ts
front/middleware/auth.global.ts
front/plugins/auth.client.ts
front/plugins/vue-query.ts
front/plugins/sync.client.ts
front/composables/useAuth.ts
front/composables/useNotes.ts
front/composables/useSync.ts
front/composables/useNoteEditor.ts
front/components/AppleStyleButton.vue
front/components/Sidebar.vue
front/components/NoteList.vue
front/components/NoteCard.vue
front/components/NoteHeader.vue
front/components/MainEditor.vue
front/components/editor/ToolbarButton.vue
front/components/editor/EditorToolbar.vue
front/components/editor/StatusBadge.vue
front/components/editor/ImageCropModal.vue
front/components/editor/extensions/ResizableImage.ts
front/components/editor/extensions/ImageResize.vue
front/pages/index.vue
front/pages/login.vue
front/pages/register.vue
front/pages/notes/index.vue
front/pages/notes/new.vue
front/pages/notes/deleted.vue
front/pages/notes/[id].vue
```

**Total : ~36 fichiers créés, ~9 fichiers supprimés / réécrits**.

---

## 9. Estimation effort

| Phase                           | Complexité | Durée estimée            |
| ------------------------------- | ---------- | ------------------------ |
| Étape 1 (bootstrap)             | Faible     | 30 min                   |
| Étape 2 (auth)                  | Faible     | 45 min                   |
| Étape 3 (services + utils)      | Moyenne    | 1 h                      |
| Étape 4 (composables)           | Élevée     | 2 h (useNoteEditor seul = 1 h) |
| Étape 5 (TipTap extension)      | Moyenne    | 45 min                   |
| Étape 6 (composants Vue)        | Élevée     | 3 h (MainEditor + Sidebar = 1 h chacun) |
| Étape 7 (pages)                 | Moyenne    | 1 h 30                   |
| Étape 8 (Docker)                | Faible     | 30 min                   |
| Étape 9 (cleanup + tests)       | Moyenne    | 1 h                      |
| **Total estimé**                |            | **~11 h**                |

---

## 10. Validation

À l'issue de chaque étape, vérifier :
1. `pnpm run dev` démarre sans erreur.
2. La fonctionnalité ciblée par l'étape est utilisable manuellement dans le navigateur.
3. `pnpm run lint` reste vert.
4. À l'étape 8, `docker compose up --build front` reproduit le comportement.

Si un blocage se présente (ex. : `vue-advanced-cropper` ne reproduit pas l'UX `react-image-crop`), documenter dans une section "Décisions revues" en bas de ce fichier et choisir le fallback du §6.

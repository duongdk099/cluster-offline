# UI Redesign Skill — NotesAides Nuxt Frontend

> **Audience** : modèles IA (Claude, Codex, Cursor, etc.) qui exécutent la refonte UI du frontend Nuxt 3 dans `front/`.
>
> **Statut** : la migration Next.js → Nuxt 3 est **terminée** ; cette skill couvre **uniquement la refonte visuelle/UX**, sans toucher à la couche métier (composables, stores, services, types, API contracts).
>
> **À lire en parallèle** : [`MIGRATION_NUXT.md`](./MIGRATION_NUXT.md) (architecture Nuxt actuelle).

---

## 1. Mission

Remplacer **intégralement** l'identité visuelle actuelle (style **iOS Notes / Apple skeuomorphique** : cream/yellow, paper-texture, fenêtres macOS avec dots rouges/jaunes/verts, three-column iPad-like, font Geist) par une identité **moderne, dense, productive, dark-first** inspirée de **Linear / Vercel / Raycast**, basée sur la bibliothèque **shadcn-vue**.

### Ce qui change
- **Tous les composants `.vue` dans `components/` et `pages/`** (markup + classes Tailwind).
- **`assets/css/main.css`** (tokens de couleurs, typographie, classes utilitaires globales).
- **`tailwind.config` / variables CSS** (palette, radius, fonts).
- **Layout général** : abandon du 3-colonnes iOS au profit d'un layout type SaaS moderne.

### Ce qui ne change PAS (intouchable)
- `composables/` (logique data, TipTap, WS).
- `stores/auth.ts`.
- `services/notesService.ts`.
- `types/notes.ts`, `utils/notes.ts`, `utils/imageOptimizer.ts`.
- `middleware/auth.global.ts`.
- `plugins/*`.
- `nuxt.config.ts` (sauf ajout du module shadcn et des fonts).
- Toutes les **signatures de props/emits** des composants ne doivent pas varier sauf si le composant est entièrement remplacé par un primitive shadcn.
- Le **contrat API** (endpoints, payload, JSON schema des notes) reste identique.
- TipTap : on garde toutes les extensions, on change juste la façon dont la barre d'outils et les bubble menus sont stylés.

---

## 2. Direction artistique

### 2.1. Référence visuelle
- **Linear** (linear.app) : dense, dark, sharp typography, hover subtle, accent unique, sidebar gauche stable.
- **Vercel Dashboard** : noir & blanc poussé à l'extrême, cards 1px border, état hover monochrome.
- **Raycast** : command palette omnipresente, badges discrets, menus contextuels riches.

### 2.2. Philosophie
- **Densité d'information** : plus de notes visibles à l'écran, plus de raccourcis claviers visibles.
- **Monochrome + 1 accent** : zinc/neutral comme palette de base, **un seul** accent (proposé : `violet-500` ou `emerald-500` — voir §3.1).
- **Bordures fines (1 px) plutôt que ombres lourdes**.
- **Radius modéré** (`rounded-md` = 6 px par défaut, jamais de `rounded-3xl`/`rounded-[28px]`).
- **Typographie** : **Inter** ou **Geist Sans** en sans-serif, **JetBrains Mono** pour les badges/IDs/timestamps.
- **Pas de glassmorphisme**, pas de blur extrême, pas de `paper-texture`, pas de fenêtre macOS.
- **Dark-mode comme défaut**, light-mode disponible via `<ThemeToggle>`.
- **Animations Framer-Motion-style** courtes (150-200 ms), `ease-out`, jamais d'`active:scale-95` (trop iOS).

### 2.3. Anti-patterns (à supprimer définitivement)
- ❌ `paper-texture`, `app-shell`, `app-frame`, `app-panel`, `app-section`, `desktop-window-titlebar`, `mobile-topbar`, `mobile-tabbar`, `mobile-sheet`, `editor-header`, `apple-table`, `apple-selection`, `apple-border`.
- ❌ Trois petits ronds `bg-red-400/90 / bg-amber-400/90 / bg-green-400/90`.
- ❌ Emojis grand format dans les empty states (`📒`, `🗑️`, `🔍`, `📭`).
- ❌ Backgrounds dégradés radial avec opacité (`bg-[radial-gradient(circle_at_15%_10%,rgba(255,179,0,0.16)…]`).
- ❌ Couleurs `bg-accent` (yellow Apple) — remplacée par l'accent monochrome.
- ❌ `data-component=` / `data-slot=` partout — remplacés par data-attrs sémantiques minimaux ou supprimés.
- ❌ Polices Geist/Geist Mono → **Inter** + **JetBrains Mono**.

---

## 3. Tech stack & dépendances

### 3.1. Tokens de design (palette)

À définir dans `assets/css/main.css` (variables CSS HSL pour shadcn-vue) :

```css
@layer base {
  :root {
    /* Light mode */
    --background: 0 0% 100%;
    --foreground: 240 10% 4%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 4%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 4%;
    --primary: 263 70% 50%;          /* violet-600 — accent unique */
    --primary-foreground: 0 0% 98%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 240 6% 10%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --accent: 240 5% 96%;
    --accent-foreground: 240 6% 10%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 6% 90%;
    --input: 240 6% 90%;
    --ring: 263 70% 50%;
    --radius: 0.5rem;
  }

  .dark {
    /* Dark mode — par défaut */
    --background: 240 10% 4%;        /* near-black */
    --foreground: 0 0% 98%;
    --card: 240 10% 6%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 6%;
    --popover-foreground: 0 0% 98%;
    --primary: 263 70% 60%;          /* violet-500 lighter for dark */
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4% 12%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 4% 12%;
    --muted-foreground: 240 5% 65%;
    --accent: 240 4% 12%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 63% 31%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 4% 16%;
    --input: 240 4% 16%;
    --ring: 263 70% 60%;
  }
}
```

**Accent unique recommandé** : `violet-500/600`. Si tu préfères autre chose, change `--primary` et `--ring`. Suggestions équivalentes : `emerald-500` (productivity green), `blue-500` (Vercel-like), `orange-500` (Linear-like dark accent).

### 3.2. Typographie

```css
@layer base {
  :root {
    --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  }
  body {
    font-family: var(--font-sans);
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
    -webkit-font-smoothing: antialiased;
  }
  code, pre, kbd, [data-mono] {
    font-family: var(--font-mono);
  }
}
```

Charger Inter + JetBrains Mono via `<link>` dans `nuxt.config.ts > app.head.link` (remplacer la ligne Geist actuelle).

### 3.3. shadcn-vue setup

shadcn-vue n'est pas un module npm classique : c'est un **CLI** qui génère les composants directement dans le projet sous `components/ui/`. Cela laisse le contrôle total sur le code.

#### Installation (une seule fois)

```bash
pnpm add -D shadcn-vue@latest
pnpm dlx shadcn-vue@latest init
# Choix recommandés :
# - Style: Default
# - Base color: Zinc (ou Neutral)
# - CSS variables: Yes
# - Tailwind config: tailwind.config.ts
# - Components alias: ~/components/ui
# - Composables alias: ~/composables
# - TypeScript: Yes
```

Ajouter ensuite les dépendances utilitaires :
```bash
pnpm add class-variance-authority clsx tailwind-merge
pnpm add reka-ui                                  # primitives radix-like pour Vue
pnpm add @vueuse/core                             # hooks utilitaires (useColorMode, useMagicKeys…)
pnpm add @internationalized/date                  # pour DatePicker si besoin
```

> ⚠️ shadcn-vue requiert un fichier `components.json` à la racine ; le générateur le crée automatiquement.

#### Composants à installer (liste minimale)

```bash
pnpm dlx shadcn-vue@latest add button input textarea label
pnpm dlx shadcn-vue@latest add card separator badge avatar
pnpm dlx shadcn-vue@latest add dialog sheet popover dropdown-menu tooltip
pnpm dlx shadcn-vue@latest add command tabs toggle toggle-group
pnpm dlx shadcn-vue@latest add scroll-area resizable
pnpm dlx shadcn-vue@latest add toast sonner                  # notifications
pnpm dlx shadcn-vue@latest add skeleton                       # loading states
pnpm dlx shadcn-vue@latest add context-menu hover-card
pnpm dlx shadcn-vue@latest add select combobox
pnpm dlx shadcn-vue@latest add alert-dialog
pnpm dlx shadcn-vue@latest add navigation-menu
pnpm dlx shadcn-vue@latest add kbd                           # afficher les raccourcis
```

> Ces composants atterrissent dans `components/ui/<name>/`. Les importer toujours via `import { Button } from '~/components/ui/button'` (ou auto-imports Nuxt si configuré).

### 3.4. Tailwind config

`tailwind.config.ts` doit être créé/mis à jour pour mapper les variables CSS shadcn :

```ts
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default <Config>{
  darkMode: ['class'],
  content: [
    './components/**/*.{vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--reka-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--reka-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate, require('@tailwindcss/typography')],
};
```

> ⚠️ Tailwind v4 PostCSS est déjà configuré. shadcn-vue fonctionne en v3 et v4 ; si conflit, déclasser à `tailwindcss@^3.4` peut être plus simple. Vérifier la doc shadcn-vue à jour avant.

### 3.5. Color mode (dark/light)

Installer `@nuxtjs/color-mode` :
```bash
pnpm add -D @nuxtjs/color-mode
```

Dans `nuxt.config.ts` :
```ts
modules: ['@pinia/nuxt', '@nuxt/eslint', '@nuxtjs/color-mode'],
colorMode: {
  classSuffix: '',
  preference: 'dark',     // dark par défaut
  fallback: 'dark',
},
```

---

## 4. Architecture de layout (refonte complète)

### 4.1. Layout actuel (à supprimer)

```
┌────────────────────────────────────────────────────────────┐
│ ● ● ●  Notes Workspace                                  ↔  │ ← desktop-window-titlebar (FAUX macOS)
├──────┬──────────────┬──────────────────────────────────────┤
│      │              │                                      │
│ Side │  NoteList    │  MainEditor / NotesOverview          │
│ bar  │  (col 2)     │  (col 3)                             │
│ (col1│              │                                      │
│      │              │                                      │
└──────┴──────────────┴──────────────────────────────────────┘
              ┌─── mobile-tabbar List/New/Home ────┐
```

### 4.2. Layout cible (Linear-inspired)

```
┌─────────────────────────────────────────────────────────────────┐
│ NotesAides    [⌘K Search…]                  [+ New] [👤▾]       │ ← top-bar (h-12, border-b 1px)
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  Sidebar     │   Main Content                                   │
│  (collapse,  │                                                  │
│   w-60→w-14) │   ┌────────────────────────────────────────────┐ │
│              │   │  Page header (breadcrumb + actions)        │ │
│  - All       │   ├────────────────────────────────────────────┤ │
│  - Tags ▾    │   │                                            │ │
│  - Folders ▾ │   │  Page body :                               │ │
│  - Trash     │   │   - Notes index : list/grid switch         │ │
│              │   │   - Note edit : editor full-width          │ │
│              │   │   - Trash : table view                     │ │
│              │   │                                            │ │
│              │   └────────────────────────────────────────────┘ │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

**Différences clés** :
- **Plus de NoteList en colonne du milieu**. La liste des notes occupe l'espace principal sur la home (`/`).
- **Quand on édite une note** (`/notes/[id]`), l'éditeur prend tout l'espace principal (sidebar reste, plus de NoteList).
- **Top-bar globale** avec search trigger Cmd+K (Command Dialog shadcn).
- **Sidebar collapsible** (icon-only en mode replié, full en mode étendu) — état persistant via `useLocalStorage` de `@vueuse/core`.
- **Mobile** : la sidebar devient un `Sheet` (drawer left), la top-bar reste, command palette toujours dispo.
- **Pas de tabbar mobile**. Bouton `+` flottant pour nouvelle note.

### 4.3. Composant `layouts/default.vue` (réécrit)

Wireframe :
```vue
<template>
  <div class="min-h-screen bg-background text-foreground antialiased">
    <AppTopBar @toggle-sidebar="sidebar.toggle" />
    <div class="flex h-[calc(100vh-3rem)]">
      <AppSidebar v-model:collapsed="sidebar.collapsed" class="hidden md:flex" />
      <main class="flex-1 overflow-hidden">
        <slot />
      </main>
    </div>
    <CommandPalette />
    <Toaster />              <!-- shadcn-vue sonner -->
  </div>
</template>
```

---

## 5. Composants — mapping ancien → nouveau

> Pour chaque composant existant, voici le composant cible (à créer ou à recréer) et les **primitives shadcn-vue** à utiliser à l'intérieur. Les **props/emits restent identiques** quand c'est possible (pour limiter les modifs dans les pages).

### 5.1. Nouveaux composants de chrome (à créer)

| Nouveau composant         | Primitives shadcn utilisées                              | Rôle                                              |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| `AppTopBar.vue`           | `Button`, `DropdownMenu`, `Avatar`, `Tooltip`, `Kbd`     | Brand + Cmd+K trigger + new note + user menu     |
| `AppSidebar.vue`          | `ScrollArea`, `Tooltip`, `Collapsible`, `Separator`     | Navigation principale (Library/Tags/Folders/Trash) |
| `CommandPalette.vue`      | `Command` (`Dialog`+`Combobox`), `Kbd`                   | Recherche globale + actions rapides (`g h`, `g t`, `n`) |
| `ThemeToggle.vue`         | `Button`, `DropdownMenu`                                 | Light/Dark/System (via `useColorMode`)            |
| `EmptyState.vue`          | (custom : icône lucide + text + `Button` CTA)            | Remplace les emojis 📒/🗑️ par icônes lucide      |
| `PageHeader.vue`          | `Breadcrumb` (custom), `Button`                          | Titre de page + actions à droite                  |

### 5.2. Composants existants — à réécrire complètement

| Composant actuel            | Cible / nouvelles primitives                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Sidebar.vue`               | **Réécrire en `AppSidebar.vue`** : `ScrollArea` + sections `Library/Tags/Folders/Trash`. Items hover monochrome (pas d'`bg-accent` jaune). Drag-n-drop conservé sur les folders. Le bouton "+" en bas devient une ligne "New folder" inline avec `Input` + `Button` size="icon" `<Plus />`. |
| `NoteList.vue`              | **Réécrire** : utiliser `ScrollArea` + cartes denses `Card` avec `border` 1 px, hover `bg-muted/50`. Plus de tag chips ronds rose, plutôt `Badge variant="secondary"`. Skeleton de chargement via `Skeleton`. Empty state via `EmptyState`. **Optionnel** : ajouter un toggle "List / Grid" via `ToggleGroup`. |
| `NoteCard.vue`              | **Réécrire** : `Card` shadcn, layout horizontal compact (image 40×40 à gauche optionnelle, titre + snippet + meta à droite). `Badge` pour tags (max 3, +N si overflow). Pas d'ombre, juste `border` + hover `bg-accent/50`. Indicateur "actif" : `border-primary` au lieu de cercle jaune. |
| `NoteHeader.vue`            | **Supprimer** (remplacé par `PageHeader.vue`).                                                            |
| `NotesOverview.vue`         | **Réécrire** : layout dashboard avec 3 stats `Card` en haut (Total/Week/Today, icônes lucide monochromes), puis "Recent notes" en grid `Card` 3-col responsive. Plus de gradient violet/yellow. |
| `MainEditor.vue`            | **Réécrire** : pleine largeur (occupe `main`). Header simplifié : breadcrumb à gauche, `StatusBadge` au centre (ou dans la status-bar bas), actions à droite (`DropdownMenu` "More" avec Share/Delete/Export). Toolbar TipTap en `Toolbar` shadcn-style flottant (`ToggleGroup` pour Bold/Italic/etc). Bubble menu image : `Popover` ancré. Folder picker : `Select` shadcn. Tags input : `Combobox` ou input custom avec chips `Badge`. |
| `EditorToolbar.vue`         | **Réécrire** en utilisant `ToggleGroup type="multiple"` (Bold/Italic) + `ToggleGroup type="single"` (alignements) + `Button variant="ghost" size="icon"` (insertions). `Tooltip` sur chaque bouton. Séparateurs `Separator orientation="vertical"`. |
| `ToolbarButton.vue`         | **Supprimer** : remplacé par `Toggle` ou `Button variant="ghost" size="icon"` shadcn directs.            |
| `StatusBadge.vue`           | **Réécrire** : `Badge variant="outline"` + indicateur dot animé selon état (saving = primary pulse, saved = emerald, optimizing = primary spin). Texte JetBrains Mono en `text-xs`. |
| `ImageCropModal.vue`        | **Réécrire** : `Dialog` shadcn-vue ; contenu = `<Cropper>` de `vue-advanced-cropper`. Footer `DialogFooter` avec `Button variant="ghost"` Cancel + `Button` Apply. |
| `AppleStyleButton.vue`      | **Supprimer** : utiliser `Button` shadcn-vue partout (variants `default` / `secondary` / `ghost` / `outline` / `destructive`). |
| `SidebarItemButton.vue`     | **Supprimer** : remplacé par helper `<NavItem>` interne à `AppSidebar.vue` (ou `Button variant="ghost"` directement). |
| `editor/extensions/ImageResize.vue` | **Conserver la logique**, retoucher visuel : poignée monochrome (`bg-primary` ring de 2px primary au lieu de halo jaune). |
| `editor/extensions/ResizableImage.ts` | **Aucun changement** (TipTap extension pure logique).                                              |

### 5.3. Pages — restructuration

| Page actuelle          | Nouvelle structure                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pages/index.vue` (home) | **Header** : `PageHeader` ("All notes", action `+ New`). **Body** : si search active → résultats en grid ; sinon → `NotesOverview` (stats + recent) **OU** liste plate selon préférence (proposer un toggle). Plus de 3-col. |
| `pages/login.vue`      | **Centered card** : `Card` au centre, max-w 400px. `CardHeader` titre+desc, `CardContent` form (`Input` + `Label` + `Button`), `CardFooter` lien vers `/register`. Background : `bg-background` + un éventuel `<DotPattern>` SVG subtil. Plus de split 2-col avec hero gauche. |
| `pages/register.vue`   | Idem login, copy adaptée.                                                                                       |
| `pages/notes/new.vue`  | Layout : sidebar visible, main = `MainEditor` pleine largeur. `PageHeader` : breadcrumb "Notes / New".          |
| `pages/notes/[id].vue` | Idem `new`, `PageHeader` : breadcrumb "Notes / {{title}}". Actions `DropdownMenu` Share/Delete/Export.          |
| `pages/notes/deleted.vue` | **Vue tableau** : `Table` shadcn-vue (`pnpm dlx shadcn-vue add table`) au lieu de la liste cliquable. Colonnes : Title / Deleted at / Actions (Restore / Delete forever). Bouton "Empty trash" en haut à droite via `AlertDialog` de confirmation. |
| `pages/notes/index.vue` | Inchangé (redirect → `/`).                                                                                      |

---

## 6. Patterns concrets à appliquer

### 6.1. Empty states

**Avant** :
```vue
<div class="text-6xl">📒</div>
<h3>No Notes Yet</h3>
```

**Après** :
```vue
<EmptyState
  :icon="FileText"
  title="No notes yet"
  description="Create your first note to get started."
>
  <Button @click="newNote"><Plus class="size-4 mr-2" /> New note</Button>
</EmptyState>
```

`EmptyState.vue` template :
```vue
<template>
  <div class="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
    <div class="rounded-full bg-muted p-3">
      <component :is="icon" class="size-6 text-muted-foreground" />
    </div>
    <h3 class="text-lg font-semibold">{{ title }}</h3>
    <p class="text-sm text-muted-foreground max-w-sm">{{ description }}</p>
    <div class="mt-2"><slot /></div>
  </div>
</template>
```

### 6.2. Confirmations destructives

Remplacer **systématiquement** `confirm()` natif par `AlertDialog` shadcn-vue :
```vue
<AlertDialog v-model:open="open">
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this note permanently?</AlertDialogTitle>
      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction @click="confirm" class="bg-destructive">Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Concerne : suppression note, suppression définitive, vider la corbeille, logout (optionnel).

### 6.3. Toasts (sonner)

Remplacer les `console.error('Failed to …')` par des toasts :
```ts
import { toast } from 'vue-sonner';

toast.error('Failed to save note', { description: err.message });
toast.success('Note restored');
```

Brancher `<Toaster richColors position="bottom-right" />` dans `layouts/default.vue`.

### 6.4. Command Palette (Cmd+K)

Composant `CommandPalette.vue` ouvert via raccourci global :
```vue
<script setup>
import { useMagicKeys } from '@vueuse/core';
const open = ref(false);
const { Cmd_K, Ctrl_K } = useMagicKeys({ passive: false, onEventFired(e){ if((e.metaKey||e.ctrlKey)&&e.key==='k'&&e.type==='keydown'){ e.preventDefault(); open.value = !open.value }}});
</script>

<template>
  <CommandDialog v-model:open="open">
    <CommandInput placeholder="Search notes, tags, folders…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Actions">
        <CommandItem @select="newNote"><Plus class="size-4 mr-2" /> New note <CommandShortcut>N</CommandShortcut></CommandItem>
        <CommandItem @select="goToTrash"><Trash class="size-4 mr-2" /> Open trash</CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Notes">
        <CommandItem v-for="note in notes" :key="note.id" @select="openNote(note)">
          <FileText class="size-4 mr-2" />{{ note.title || 'Untitled' }}
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
```

### 6.5. Status bar (bas de l'éditeur, optionnel mais recommandé)

```
┌──────────────────────────────────────────────────────────────┐
│  ● Saved 2s ago   Folder: Personal   #idea  #wip   234 words │
└──────────────────────────────────────────────────────────────┘
```

Composant `EditorStatusBar.vue` fixé en bas de la page d'édition, `border-t`, `text-xs`, `font-mono`.

### 6.6. Skeletons de chargement

Remplacer toute animation `animate-pulse` custom par `Skeleton` :
```vue
<div v-if="isLoading" class="space-y-2">
  <Skeleton v-for="i in 6" :key="i" class="h-16 w-full" />
</div>
```

### 6.7. Tooltips & Kbd

Sur tous les boutons d'action principaux, wrapper avec `Tooltip` et afficher la touche raccourci avec `Kbd` :
```vue
<Tooltip>
  <TooltipTrigger as-child>
    <Button variant="ghost" size="icon" @click="newNote"><Plus /></Button>
  </TooltipTrigger>
  <TooltipContent>New note <Kbd>N</Kbd></TooltipContent>
</Tooltip>
```

---

## 7. Iconographie

- **Conserver** `lucide-vue-next` (déjà installé). Ne PAS introduire d'autre lib d'icônes.
- **Standard** : `class="size-4"` (16 px) pour les icônes inline texte ; `size-5` (20 px) pour boutons d'action ; `size-6` (24 px) pour icônes en empty states ; `size-8`+ uniquement pour les illustrations principales.
- Stroke par défaut : `stroke-width=1.5` (lucide default) ou `2` pour plus de présence. Plus jamais `2.5` qui était le style Apple.

---

## 8. Plan d'exécution recommandé pour le modèle

> Suivre cet ordre garantit qu'à chaque étape l'app reste démarrable.

1. **Setup (15 min)**
   - Installer shadcn-vue (`init` + composants listés §3.3).
   - Installer `@nuxtjs/color-mode`, `@vueuse/core`, `tailwindcss-animate`, `vue-sonner`.
   - Réécrire `tailwind.config.ts` (§3.4).
   - Réécrire `assets/css/main.css` : supprimer les 520 lignes Apple, garder uniquement `@import "tailwindcss"` + tokens shadcn (§3.1) + petits utilitaires (`.scrollbar-thin`, `prose` overrides minimaux).
   - Charger Inter + JetBrains Mono dans `nuxt.config.ts > app.head`.

2. **Chrome global (45 min)**
   - Créer `AppTopBar.vue`, `AppSidebar.vue`, `ThemeToggle.vue`, `CommandPalette.vue`, `EmptyState.vue`, `PageHeader.vue`.
   - Réécrire `layouts/default.vue`.
   - Brancher `<Toaster />`.

3. **Pages auth (20 min)**
   - Réécrire `pages/login.vue` + `pages/register.vue` en `Card` centrée. Tester E2E auth.

4. **Liste & home (45 min)**
   - Réécrire `NoteCard.vue`, `NoteList.vue`, `NotesOverview.vue`.
   - Réécrire `pages/index.vue`.

5. **Sidebar (30 min)**
   - Implémenter `AppSidebar` complet (Library + Tags + Folders + Trash + drag-n-drop).
   - Tester filtres tag/folder, création folder, drop note → folder.

6. **Trash (20 min)**
   - Installer `Table` shadcn (`pnpm dlx shadcn-vue add table`).
   - Réécrire `pages/notes/deleted.vue` en table + `AlertDialog` confirmations.

7. **Éditeur (60 min)**
   - Réécrire `EditorToolbar.vue` (`ToggleGroup` + `Tooltip`).
   - Réécrire `StatusBadge.vue` (`Badge` + dot).
   - Réécrire `ImageCropModal.vue` (`Dialog`).
   - Réécrire `MainEditor.vue` (header + body + status bar).
   - Retoucher `ImageResize.vue` (poignée monochrome).
   - Tester : autosave, upload, crop, rotate, resize, bubble menu image.

8. **Polish (30 min)**
   - Toasts à la place des `console.error`.
   - Tooltips sur tous les boutons icon-only.
   - Vérifier light/dark mode sur chaque page.
   - Vérifier responsive : sidebar → Sheet sur mobile, top-bar reste, command palette OK.
   - `pnpm run lint` zéro erreur.
   - `pnpm run build` zéro erreur.

**Total estimé : ~4-5 h** pour un modèle qui exécute sans hésitation.

---

## 9. Critères d'acceptation visuels

L'utilisateur doit pouvoir, en ouvrant l'app, **immédiatement** constater :

- [ ] **Dark mode par défaut** au premier chargement.
- [ ] **Aucune trace** de la palette yellow Apple (`#ffb300` etc.) ni de `paper-texture` ni de `apple-border`.
- [ ] **Aucun titlebar macOS** (cercles rouge/jaune/vert).
- [ ] **Top-bar moderne** présente sur toutes les pages avec brand à gauche, search Cmd+K au centre, actions/profil à droite.
- [ ] **Sidebar collapsible** : icon-only en mode replié, items avec hover monochrome.
- [ ] **Command Palette** (Cmd+K / Ctrl+K) ouvre un dialog de recherche/actions.
- [ ] **Pas de 3-colonnes iOS** : la liste des notes occupe le main quand on est sur `/`, l'éditeur occupe le main quand on édite.
- [ ] **Cards de notes** denses avec `border` 1px, `rounded-md`, hover `bg-muted/50`.
- [ ] **Confirmations destructives** via `AlertDialog`, plus de `confirm()` natif.
- [ ] **Toasts** sonner pour erreurs/succès au lieu de `console.error`.
- [ ] **Skeletons** shadcn pour tous les loading states.
- [ ] **Empty states** avec icônes lucide dans cercle muted, plus d'emojis grand format.
- [ ] **Trash** affichée comme `Table` shadcn (et non liste cliquable).
- [ ] **Login/Register** centrés en `Card` (plus de split 2-col gradient).
- [ ] **Toutes les fonctionnalités** continuent de marcher (auth, CRUD, autosave, upload/crop/rotate, drag-folder, WS sync, search).
- [ ] **Light mode** disponible via `ThemeToggle`, design cohérent.
- [ ] **Mobile** : sidebar en `Sheet`, top-bar adaptée, FAB `+` en bas-droite pour new note.

---

## 10. Don'ts (interdictions strictes)

1. **Ne pas toucher** à `composables/`, `stores/`, `services/`, `types/`, `utils/`, `middleware/`, `plugins/` (sauf ajout explicitement autorisé : color-mode, sonner si besoin).
2. **Ne pas changer** les signatures de props/emits documentées dans le `MainEditor` ou `useNoteEditor` — l'interface entre la logique et la vue reste identique.
3. **Ne pas introduire** d'autres bibliothèques UI (Element Plus, PrimeVue, Vuetify, Naive UI…). Uniquement **shadcn-vue + reka-ui + lucide-vue-next**.
4. **Ne pas garder** `AppleStyleButton`, `SidebarItemButton`, `NoteHeader` — ces composants sont supprimés au profit des primitives shadcn.
5. **Ne pas laisser** des classes Tailwind taillées sur mesure pour l'ancien design (`bg-accent` jaune, `bg-apple-selection`, `border-apple-border`, `paper-texture`, `app-shell`, etc.) — toutes ces classes doivent disparaître du codebase.
6. **Ne pas styler** avec des couleurs hardcodées hex/rgb hors palette HSL shadcn — toujours via `bg-primary`, `text-muted-foreground`, etc.
7. **Ne pas réintroduire** Geist comme police principale.
8. **Ne pas casser** le contrat avec l'API : aucune modification de `notesService.ts` ou des endpoints.

---

## 11. Livrables attendus (récap fichiers)

### Créés / nouveaux
```
front/components.json                          # config shadcn-vue
front/tailwind.config.ts                       # mapping HSL shadcn
front/components/ui/**                         # composants shadcn générés (button, card, dialog, …)
front/components/AppTopBar.vue
front/components/AppSidebar.vue
front/components/CommandPalette.vue
front/components/ThemeToggle.vue
front/components/EmptyState.vue
front/components/PageHeader.vue
front/components/EditorStatusBar.vue           # optionnel (status bar pied de page)
```

### Réécrits (markup + classes — la logique reste)
```
front/layouts/default.vue
front/assets/css/main.css
front/nuxt.config.ts                           # head fonts + module color-mode
front/components/NoteCard.vue
front/components/NoteList.vue
front/components/NotesOverview.vue
front/components/MainEditor.vue
front/components/editor/EditorToolbar.vue
front/components/editor/StatusBadge.vue
front/components/editor/ImageCropModal.vue
front/components/editor/extensions/ImageResize.vue
front/pages/index.vue
front/pages/login.vue
front/pages/register.vue
front/pages/notes/new.vue
front/pages/notes/[id].vue
front/pages/notes/deleted.vue
```

### Supprimés
```
front/components/AppleStyleButton.vue
front/components/SidebarItemButton.vue         # absorbé dans AppSidebar
front/components/NoteHeader.vue                # remplacé par PageHeader
front/components/Sidebar.vue                   # remplacé par AppSidebar
```

### Inchangés (ne pas toucher)
```
front/composables/**                            # logique métier
front/stores/**
front/services/**
front/types/**
front/utils/**
front/middleware/**
front/plugins/**
front/components/editor/extensions/ResizableImage.ts
front/Dockerfile, front/.env.*, front/package.json (sauf ajout deps shadcn)
```

---

## 12. Validation finale

À l'issue du redesign, exécuter :
```bash
cd front
pnpm install
pnpm run lint        # zéro erreur
pnpm run build       # .output/ généré sans erreur
pnpm run dev         # → http://localhost:3000

# Faire un tour complet :
# 1. /login → auth → /
# 2. Cmd+K → recherche → ouvrir une note
# 3. + New → écrire → autosave → toast
# 4. Sidebar : créer folder, drag note dans folder
# 5. Trash → restore → permanent delete via AlertDialog
# 6. Toggle dark/light → cohérence sur les 7 pages
# 7. Resize fenêtre → mobile : sidebar = Sheet
# 8. Lancer un autre client en parallèle → WS sync = liste mise à jour
```

Si toutes les checkbox du §9 sont vertes et que `build` passe : **livraison validée**.

---

## 13. Annexe — Brief court pour résumer cette skill

> *Pour un modèle qui n'a pas le temps de tout lire :*
>
> **Tu refais entièrement l'UI du frontend Nuxt 3 dans `front/`. Tu gardes la logique métier (composables, stores, services). Tu remplaces tout le markup/CSS Apple-iOS (cream/yellow/paper-texture/3-col/macOS-titlebar) par une UI Linear-like : dark-first, monochrome zinc + accent violet, dense, shadcn-vue + reka-ui + lucide-vue-next, layout top-bar + sidebar collapsible + main, command palette Cmd+K, AlertDialog pour confirmations, sonner pour toasts, Skeleton pour loadings, Card/Table/Dialog/Sheet/Popover/Tooltip/DropdownMenu pour le reste. Tu vérifies que les 16 critères d'acceptation visuels du §9 sont remplis et que `pnpm run build` passe sans erreur.*

# Update — Lazy-loading global + dropdown folder shadcn-style

> **Contexte** : retour utilisateur sur le redesign UI Nuxt.
> Deux problèmes résiduels après les fixes hydratation / theme switch / drag-drop :
> 1. Le lazy-loading visuel (loading bar + page transition) ne se déclenche que sur les **changements de route** (Library ↔ Trash ↔ Note). Il ne couvre **pas** les changements de filtre (`/?tag=A` → `/?tag=B`, ni folder→folder), ni les changements de note (note → note dans `/notes/[id]`).
> 2. Le dropdown de sélection de folder dans l'éditeur de note (page `new` et `[id]`) garde l'**apparence native du `<select>` du navigateur** lors de l'ouverture (la liste blanche/grise sans le style shadcn).

---

## 1. Lazy-loading étendu à toute l'application

### Problème
- `pages/index.vue` reste mounté quand on change `?tag=A` → `?tag=B` (même chemin, query différente). Vue Router ne réinstancie pas le composant donc la `<Transition name="page">` de `<NuxtPage>` (déclarée dans `app.vue`) ne se joue pas, et la `<NuxtLoadingIndicator>` ne s'arme pas.
- `pages/notes/[id].vue` : Vue Router réutilise le même composant pour `/notes/A` et `/notes/B` (même fichier, params différents). Sans clé explicite, le composant n'est pas remonté donc pas de transition non plus.

### Fix

#### A. Page d'accueil — `pages/index.vue`
On garde le composant de page mounté (pour conserver l'état local : `searchQuery`, `viewMode`) mais on ajoute :

1. **Une `<Transition name="page" mode="out-in">` autour du body de la page**, **clé sur `viewKey`** qui change avec n'importe quel filtre :
   ```ts
   const viewKey = computed(() =>
     `${selectedTag.value}::${selectedFolder.value}::${normalizedSearchQuery.value}`,
   );
   ```
2. **Un `useLoadingIndicator()` armé manuellement** sur chaque changement de filtre :
   ```ts
   const loading = useLoadingIndicator();
   watch(viewKey, () => {
     loading.start();
     setTimeout(() => loading.finish(), 240);
   });
   ```

Résultat : changer `?tag=foo` → `?tag=bar` (ou folder→folder, ou texte de recherche) joue le même fade-up + barre violette qu'une vraie navigation.

#### B. Page d'édition d'une note — `pages/notes/[id].vue`
Ajout de `definePageMeta` pour forcer la remount à chaque changement de fullPath :
```ts
definePageMeta({
  key: (route) => route.fullPath,
});
```
Vue Router/Nuxt voient désormais `/notes/A` et `/notes/B` comme deux instances différentes du composant. La `<Transition name="page">` joue, et la barre de chargement s'arme automatiquement le temps que `useNote(id)` (Vue Query) revalide.

> ℹ️ Le cache Vue Query reste partagé : si la note B a déjà été chargée, son contenu apparaît instantanément après la transition. Pas de re-fetch inutile.

#### C. Pages déjà OK
- `pages/login.vue`, `pages/register.vue`, `pages/notes/new.vue`, `pages/notes/deleted.vue`, `pages/notes/index.vue` : routes distinctes → la transition globale fonctionne déjà.

---

## 2. Dropdown folder — composant `FolderPicker.vue`

### Problème
Dans `MainEditor.vue`, le picker de folder utilisait l'astuce classique « `<select>` invisible (`opacity-0`) superposé sur un `<label>` stylé ». Quand l'utilisateur clique :
- ✅ Le **trigger** (le label avec icône + texte + chevron) **est** stylé shadcn.
- ❌ La **liste qui s'ouvre** est rendue par le navigateur (Chrome/Firefox/Safari) → fond blanc/gris, sans cohérence avec la palette dark, sans border-radius shadcn, sans icônes.

### Fix
Remplacement par un nouveau composant **`components/FolderPicker.vue`** : popover custom basé sur :
- `onClickOutside` de `@vueuse/core` (déjà installé) pour fermer au clic externe.
- `<Transition>` avec scale/translate pour l'animation d'apparition (150 ms enter / 100 ms leave).
- Layout shadcn : `border` + `bg-popover` + `text-popover-foreground` + `shadow-lg` + `rounded-md` + `max-h-64 overflow-y-auto scrollbar-thin`.
- Icônes lucide : `FolderOpen` pour les items, `Check` pour l'élément sélectionné, `ChevronDown` qui rotate de 180° à l'ouverture.
- Item « No folder » en haut + séparateur + liste des folders + état vide stylisé.
- Accessible : `aria-expanded`, `aria-haspopup="listbox"`, `role="option"`, `aria-selected`, `Escape` pour fermer.

API du composant :
```vue
<FolderPicker
  :folders="folders ?? []"
  :model-value="folderId"
  @update:model-value="handleFolderChange"
/>
```

C'est un `v-model` standard (`modelValue` / `update:modelValue`), donc :
```vue
<FolderPicker v-model="folderId" :folders="folders ?? []" />
```
fonctionne aussi.

---

## 3. Fichiers modifiés

| Fichier                                  | Type         | Changement                                                              |
| ---------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `app.vue`                                | (inchangé)   | `<NuxtLoadingIndicator>` + `<NuxtPage :transition>` déjà en place.      |
| `pages/index.vue`                        | **modifié**  | `viewKey`, `useLoadingIndicator`, `<Transition name="page">` interne.   |
| `pages/notes/[id].vue`                   | **modifié**  | `definePageMeta({ key: route => route.fullPath })`.                     |
| `components/FolderPicker.vue`            | **créé**     | Dropdown custom shadcn-vue.                                             |
| `components/MainEditor.vue`              | **modifié**  | Remplacement du `<select>`/`<label>` par `<FolderPicker>` + nettoyage des imports `ChevronDown` / `FolderOpen`. |

---

## 4. Démonstration / test

```bash
cd front
pnpm run dev
```

### A. Lazy-loading

1. Aller sur `/`, créer un tag (`#alpha`) et un autre (`#beta`) sur deux notes différentes.
2. Cliquer dans la sidebar sur `#alpha` → on observe :
   - barre violette en haut (NuxtLoadingIndicator) pendant ~240 ms,
   - fade-up subtil du contenu (translateY 4px → 0).
3. Cliquer sur `#beta` → **la même animation se joue** (avant ce fix, l'écran sautait sans transition).
4. Idem pour folder → folder.
5. Idem pour la barre de recherche (chaque keystroke trim un nouveau `viewKey`).
6. Ouvrir une note → ouvrir une autre note depuis la liste → animation de page complète + barre de chargement.

### B. Folder dropdown

1. Aller sur `/notes/new` ou ouvrir une note existante.
2. Cliquer sur le bouton « No folder » (avec icône `FolderOpen` + chevron).
3. Vérifier :
   - Le panneau qui s'ouvre est **dark** (en dark mode) avec `border` + `shadow-lg`.
   - L'élément actuellement sélectionné a une coche violette `Check` à droite.
   - Hover sur un item : `bg-accent` cohérent avec le reste de l'UI.
   - Échap ferme le panneau et redonne le focus au trigger.
   - Click outside ferme aussi.
4. Sélectionner un folder → le trigger affiche le nom du folder, la coche se déplace.

---

## 5. Notes pour les autres modèles / contributeurs

- **Pour ajouter une nouvelle page filtrable** (ex : `/projects?status=...`), réutiliser le pattern `viewKey` + `<Transition name="page">` + `useLoadingIndicator` du `pages/index.vue`.
- **Pour ajouter une route paramétrée** où chaque param mérite sa transition (ex : `/users/[id]`), ajouter `definePageMeta({ key: route => route.fullPath })`.
- **Pour ajouter un autre dropdown shadcn-style** (ex : sélecteur de tag, sélecteur de couleur), copier le pattern de `FolderPicker.vue` :
  - `onClickOutside` + `triggerRef` ignoré.
  - `<Transition>` avec `enter-active-class` / `enter-from-class` etc.
  - Classes shadcn : `bg-popover`, `text-popover-foreground`, `border`, `shadow-lg`, `rounded-md`, `scrollbar-thin`.
  - A11y : `aria-expanded`, `aria-haspopup`, `role`, gestion clavier `Escape`.
- **Si shadcn-vue ajoute officiellement un `Select` plus tard** (`pnpm dlx shadcn-vue@latest add select`), `FolderPicker.vue` peut être remplacé sans changement d'API côté `MainEditor.vue` (il faudra juste re-mapper les props `v-model` → `defaultValue`/`onUpdate:modelValue`).

---

## 6. Diagnostics non bloquants

L'IDE signale deux warnings sur `pages/index.vue` :
```
The class `min-h-[460px]` can be written as `min-h-115`
```
Corrigés dans la même passe (`min-h-[460px]` → `min-h-115` aux lignes 123 et 136).

Aucun autre lint warning ni erreur de build attendue.

# Update — Theme switch synchronization

> **Contexte** : retour utilisateur sur le toggle dark/light.
>
> > « Quand je change entre dark et light mode, le timing des changements de composants n'est pas synchronisé : ils ne commencent pas en même temps, ne finissent pas dans le même ordre (gauche→droite, haut→bas, ou autre cohérent). C'est totalement aléatoire et très énervant. »

---

## 1. Cause racine

Le swap de thème modifie une vingtaine de variables CSS HSL sur `:root` (ou `.dark`). Tous les éléments qui consomment ces tokens (`bg-background`, `border-border`, `text-foreground`, `bg-card`, etc.) reçoivent leur nouvelle valeur **en même temps**.

**Mais** chaque élément joue ensuite **sa propre transition CSS**, avec sa propre durée et son propre delay :

| Source                                                           | `transition-duration` typique |
| ---------------------------------------------------------------- | ----------------------------- |
| Tailwind `transition-colors`                                     | **150 ms**                    |
| Tailwind `transition-all duration-200`                           | 200 ms                        |
| Notre règle globale `*, *::before, *::after`                     | 200 ms                        |
| shadcn `Button`, `Card`, `Badge` (utilities composées)           | 150 ms                        |
| `vue-sonner` toaster                                             | ~200 ms                       |
| Animations TipTap, prose, scrollbars                             | divers                        |

Le navigateur batche aussi les peints : chaque calque (z-index, filter, transform 3D) repaint à un moment légèrement différent. Résultat : un gradient temporel de 150 → 250 ms qui apparaît comme un « wash aléatoire » au lieu d'un swap unifié.

C'est un bug visuel classique de tout site qui combine custom CSS + Tailwind + une lib de composants : aucun contrôle central sur la coordination du repaint.

---

## 2. Fix — deux mécanismes complémentaires

### Mécanisme A — Désactivation atomique (fallback universel)

Avant de muter `colorMode.preference`, on ajoute la classe `theme-switching` sur `<html>`. Une règle CSS associée **kill toutes les transitions et animations** pendant ce laps :

```css
.theme-switching,
.theme-switching *,
.theme-switching *::before,
.theme-switching *::after {
  transition: none !important;
  animation: none !important;
}
```

`!important` est nécessaire parce que les classes Tailwind (`transition-colors`) compilent en règles utility avec une spécificité supérieure à un sélecteur universel sans `!important`.

On retire la classe **deux frames plus tard** (`requestAnimationFrame` × 2) : assez pour que le navigateur ait :
1. recalculé la cascade,
2. reflowé,
3. peint avec les nouvelles valeurs.

Effet : le swap est **instantané**, comme si la page changeait d'état d'un seul coup. Pas de wave.

### Mécanisme B — View Transitions API (Chromium + Safari récent)

Quand `document.startViewTransition` existe, on l'utilise pour wrapper le swap. Le navigateur :
1. snapshot la page actuelle,
2. applique nos changements (classe `.dark` togglée),
3. snapshot le nouvel état,
4. interpole entre les deux snapshots via deux pseudo-éléments :

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 260ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

Effet : un **crossfade global** parfaitement synchronisé contrôlé par le compositor. Aucun élément ne peut désynchroniser puisqu'on interpole deux images, pas N composants.

### Hiérarchie

1. Browser supporte View Transitions API → **crossfade 260 ms** (smooth, ce qu'on veut).
2. Sinon → `theme-switching` désactive les transitions → **swap instantané** (toujours synchronisé, même si moins « lisse »).

Dans les deux cas, le wave aléatoire disparaît.

---

## 3. Code livré

### `components/ThemeToggle.vue`

```ts
function cycleMode() {
  const next = nextPreference(colorMode.preference);
  const root = document.documentElement;
  root.classList.add('theme-switching');

  const apply = () => { colorMode.preference = next; };

  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(apply).finished.finally(() => {
      root.classList.remove('theme-switching');
    });
  } else {
    apply();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });
  }
}
```

### `assets/css/main.css`

- Règle `.theme-switching *` durcie avec `transition: none !important; animation: none !important;`.
- Bloc `@supports (view-transition-name: root)` ajouté pour piloter la durée et le timing de la crossfade.

---

## 4. Test

```bash
cd front
pnpm run dev
```

### A. Toggle dark/light en boucle (Chrome / Edge / Safari récent)
- Cliquer plusieurs fois sur l'icône thème en haut à droite.
- Observer : **fondu enchaîné global** sur ~260 ms, plus de cascade aléatoire.
- Aucun composant ne « traîne » derrière les autres.
- Hovers, animations, transitions de page restent fluides hors du moment du swap.

### B. Toggle dark/light dans un browser sans View Transitions API (Firefox actuellement)
- Cliquer sur l'icône thème.
- Observer : **swap instantané** (≈ 1 frame, indistinguable).
- Pas de fondu, mais surtout pas de wave non plus.
- Comportement souhaité : tous les composants changent au même instant.

### C. Vérifier qu'on ne casse rien
- Hovers sur les boutons / cards : transitions normales (150 / 200 ms) toujours présentes.
- Page transitions (`/?tag=A` → `/?tag=B`, `/notes/A` → `/notes/B`) : toujours fluides.
- Drag-and-drop d'une note vers un folder : pulse / wiggle / ring toujours OK.

---

## 5. Notes pour les autres modèles

### Pour ajouter un autre toggle qui mute beaucoup de tokens en cascade
(ex : changement de palette d'accent, switch de density, switch RTL/LTR) → réutiliser le pattern :
```ts
const root = document.documentElement;
root.classList.add('theme-switching');
const apply = () => { /* le mut massif */ };
if (document.startViewTransition) {
  document.startViewTransition(apply).finished.finally(() =>
    root.classList.remove('theme-switching'),
  );
} else {
  apply();
  requestAnimationFrame(() => requestAnimationFrame(() =>
    root.classList.remove('theme-switching'),
  ));
}
```

### Pour personnaliser l'effet de transition de thème
Modifier les keyframes `::view-transition-old(root)` et `::view-transition-new(root)`. Exemples :
- **Wipe diagonal** : `clip-path` animé du coin haut-gauche au coin bas-droit.
- **Iris** depuis le bouton ThemeToggle : capturer la position du clic, partir d'un disque de rayon 0 à plein écran (cf. exemples Chrome Dev Blog « Smooth and simple transitions with the View Transitions API »).
- **Fade lent** pour un feel premium : porter la durée à 400 ms.

### Don'ts
- ❌ Ne pas remettre une `transition` globale plus courte que 200 ms : ça réintroduit le wave (les éléments avec Tailwind `transition-colors` à 150 ms finissent avant les autres).
- ❌ Ne pas mettre la `transition` globale à `transition: all` : ça transition aussi `transform`, `opacity`, etc., ce qui rend les hovers et page-transitions lourds.
- ❌ Ne pas oublier le double `requestAnimationFrame` du fallback : un seul ne laisse pas le temps au browser de peindre la nouvelle valeur, et la dernière frame du swap tween toujours.

---

## 6. Fichiers modifiés

| Fichier                          | Type        | Changement                                                            |
| -------------------------------- | ----------- | --------------------------------------------------------------------- |
| `components/ThemeToggle.vue`     | **modifié** | `cycleMode()` réécrit avec View Transitions API + `theme-switching`.  |
| `assets/css/main.css`            | **modifié** | `.theme-switching *` durci + bloc `@supports (view-transition-name)`. |

Aucun autre composant ni page n'est impacté.

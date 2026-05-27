<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';

const colorMode = useColorMode();

const icon = computed(() => {
  if (colorMode.preference === 'light') return Sun;
  if (colorMode.preference === 'system') return Monitor;
  return Moon;
});

function nextPreference(current: string) {
  if (current === 'dark') return 'light';
  if (current === 'light') return 'system';
  return 'dark';
}

function cycleMode() {
  const next = nextPreference(colorMode.preference);

  // The theme swap touches dozens of CSS variables across the page.
  // Without coordination, each element runs its own transition with its
  // own duration (Tailwind's transition-colors = 150ms, our global = 200ms,
  // shadcn primitives = various) and the result is a chaotic "wave" of
  // colors arriving at different times.
  //
  // Two-pronged fix:
  //  1. Add `.theme-switching` on <html> so our CSS kills ALL transitions
  //     for one frame → the swap is atomic, every pixel updates at once.
  //  2. If the browser supports the View Transitions API, wrap the swap
  //     in startViewTransition() so it is rendered as a single, snapshot
  //     based crossfade controlled by ::view-transition-old/new in CSS.
  const root = document.documentElement;
  root.classList.add('theme-switching');

  const apply = () => {
    colorMode.preference = next;
  };

  type DocWithVT = Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  const docVT = document as DocWithVT;

  if (typeof docVT.startViewTransition === 'function') {
    const transition = docVT.startViewTransition(apply);
    transition.finished.finally(() => {
      root.classList.remove('theme-switching');
    });
  } else {
    apply();
    // Wait two frames so the new tokens are committed and painted before
    // re-enabling transitions, otherwise the very tail of the swap can
    // still tween for a frame.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });
  }
}
</script>

<template>
  <ClientOnly>
    <Button
      variant="ghost"
      size="icon"
      :title="`Theme: ${colorMode.preference}`"
      aria-label="Toggle theme"
      @click="cycleMode"
    >
      <component :is="icon" class="size-4 transition-transform duration-300" />
    </Button>
    <template #fallback>
      <Button variant="ghost" size="icon" aria-label="Toggle theme">
        <Moon class="size-4" />
      </Button>
    </template>
  </ClientOnly>
</template>

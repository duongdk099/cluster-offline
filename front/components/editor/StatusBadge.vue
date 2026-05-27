<script setup lang="ts">
import type { SaveStatus } from '~/composables/useNoteEditor';
import { formatRelativeTime } from '~/utils/notes';

const props = defineProps<{
  status: SaveStatus;
  createdAt?: string;
  updatedAt?: string;
}>();

const idleLabel = computed(() => {
  if (props.updatedAt) return `Updated ${formatRelativeTime(props.updatedAt)}`;
  if (props.createdAt) return formatRelativeTime(props.createdAt);
  return 'Draft';
});

const statusLabel = computed(() => {
  if (props.status === 'optimizing') return 'Optimizing';
  if (props.status === 'cropping') return 'Cropping';
  if (props.status === 'rotating') return 'Rotating';
  if (props.status === 'saving') return 'Saving';
  if (props.status === 'saved') return 'Saved';
  return idleLabel.value;
});

const dotClass = computed(() => {
  if (props.status === 'saved') return 'bg-primary';
  if (props.status === 'idle') return 'bg-muted-foreground';
  return 'animate-pulse bg-primary';
});
</script>

<template>
  <div class="inline-flex h-7 items-center gap-2 rounded-md border px-2.5 font-mono text-[11px] text-muted-foreground">
    <span class="size-1.5 rounded-full" :class="dotClass" />
    <span>{{ statusLabel }}</span>
  </div>
</template>

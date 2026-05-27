<script setup lang="ts">
defineProps<{
  folderName?: string | null;
  tags?: string[];
  wordCount?: number;
}>();
</script>

<template>
  <footer class="flex min-h-9 flex-wrap items-center gap-3 border-t bg-background px-4 py-2 font-mono text-[11px] text-muted-foreground">
    <span>Folder: {{ folderName || 'None' }}</span>
    <span v-if="(tags ?? []).length > 0" class="truncate">
      {{ (tags ?? []).map((tag) => `#${tag}`).join(' ') }}
    </span>
    <span class="ml-auto">{{ wordCount ?? 0 }} words</span>
  </footer>
</template>

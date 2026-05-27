<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <header class="flex min-h-16 flex-col gap-3 border-b bg-background px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
    <div class="min-w-0">
      <p v-if="eyebrow" class="mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {{ eyebrow }}
      </p>
      <h1 class="truncate text-xl font-semibold tracking-tight">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-1 text-sm text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

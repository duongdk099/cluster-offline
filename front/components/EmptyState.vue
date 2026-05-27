<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  icon: Component;
  title: string;
  description: string;
}>();
</script>

<template>
  <div class="flex min-h-[280px] flex-col items-center justify-center gap-3 px-4 py-12 text-center">
    <div class="rounded-full border bg-muted p-3">
      <component :is="icon" class="size-6 text-muted-foreground" />
    </div>
    <h3 class="text-lg font-semibold">
      {{ title }}
    </h3>
    <p class="max-w-sm text-sm text-muted-foreground">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>

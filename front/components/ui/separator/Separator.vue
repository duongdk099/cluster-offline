<script setup lang="ts">
withDefaults(defineProps<{
  orientation?: 'horizontal' | 'vertical';
}>(), {
  orientation: 'horizontal',
});
</script>

<template>
  <div
    role="separator"
    :class="orientation === 'vertical' ? 'h-full w-px bg-border' : 'h-px w-full bg-border'"
  />
</template>

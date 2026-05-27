<script setup lang="ts">
import { cn } from '../utils';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}>(), {
  variant: 'default',
});

const variantClasses = computed(() => ({
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  outline: 'border-border text-foreground',
  destructive: 'border-transparent bg-destructive text-destructive-foreground',
}[props.variant]));
</script>

<template>
  <span
    v-bind="$attrs"
    :class="cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
      variantClasses,
    )"
  >
    <slot />
  </span>
</template>

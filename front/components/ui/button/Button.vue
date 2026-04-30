<script setup lang="ts">
import { cn } from '../utils';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  type?: 'button' | 'submit' | 'reset';
}>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
});

const variantClasses = computed(() => ({
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
}[props.variant]));

const sizeClasses = computed(() => ({
  default: 'h-9 px-4 py-2',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-10 px-5',
  icon: 'size-8',
}[props.size]));
</script>

<template>
  <button
    :type="type"
    v-bind="$attrs"
    :class="cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      variantClasses,
      sizeClasses,
    )"
  >
    <slot />
  </button>
</template>

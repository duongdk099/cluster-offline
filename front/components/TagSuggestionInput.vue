<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';
import { Check, Hash, Plus, Search } from 'lucide-vue-next';
import type { NoteTag } from '~/types/notes';

const props = withDefaults(defineProps<{
  availableTags: NoteTag[];
  selectedTags: string[];
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  placeholder: 'Add tag',
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  add: [value: string];
  cancel: [];
}>();

const rootRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const highlightedIndex = ref(0);

const normalizedQuery = computed(() => props.modelValue.trim().replace(/^#+/, '').toLowerCase());
const selectedTagSet = computed(() => new Set(props.selectedTags.map((tag) => tag.trim().toLowerCase())));
const suggestions = computed(() => {
  const query = normalizedQuery.value;

  return props.availableTags
    .filter((tag) => !selectedTagSet.value.has(tag.name.trim().toLowerCase()))
    .filter((tag) => !query || tag.name.toLowerCase().includes(query))
    .slice(0, 8);
});
const hasExactSuggestion = computed(() =>
  props.availableTags.some((tag) => tag.name.trim().toLowerCase() === normalizedQuery.value),
);
const canCreate = computed(() =>
  normalizedQuery.value.length > 0 &&
  !hasExactSuggestion.value &&
  !selectedTagSet.value.has(normalizedQuery.value),
);
const optionCount = computed(() => suggestions.value.length + (canCreate.value ? 1 : 0));

watch([suggestions, canCreate], () => {
  highlightedIndex.value = 0;
});

onMounted(async () => {
  await nextTick();
  inputRef.value?.focus();
});

onClickOutside(rootRef, () => {
  commitOrCancel();
});

function commitOrCancel() {
  if (props.modelValue.trim()) {
    emit('add', props.modelValue);
    return;
  }

  emit('cancel');
}

function pick(value: string) {
  emit('add', value);
}

function highlightedValue() {
  if (suggestions.value[highlightedIndex.value]) {
    return suggestions.value[highlightedIndex.value].name;
  }

  if (canCreate.value && highlightedIndex.value === suggestions.value.length) {
    return props.modelValue;
  }

  return props.modelValue;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (optionCount.value === 0) return;
    highlightedIndex.value = (highlightedIndex.value + 1) % optionCount.value;
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (optionCount.value === 0) return;
    highlightedIndex.value = (highlightedIndex.value - 1 + optionCount.value) % optionCount.value;
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    pick(highlightedValue());
    return;
  }

  if (event.key === ',') {
    event.preventDefault();
    pick(props.modelValue);
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    emit('cancel');
  }
}
</script>

<template>
  <div ref="rootRef" class="relative">
    <div class="flex h-8 w-48 items-center gap-2 rounded-md border border-dashed bg-background px-2 text-sm focus-within:ring-2 focus-within:ring-ring">
      <Search class="size-4 shrink-0 text-muted-foreground" />
      <input
        ref="inputRef"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
        class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown="onKeydown"
      >
    </div>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="!disabled"
        role="listbox"
        class="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 origin-top-left overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg outline-none scrollbar-thin"
      >
        <button
          v-for="(tag, index) in suggestions"
          :key="tag.id"
          type="button"
          role="option"
          :aria-selected="highlightedIndex === index"
          class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          :class="highlightedIndex === index ? 'bg-accent' : ''"
          @mouseenter="highlightedIndex = index"
          @click="pick(tag.name)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <Hash class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ tag.name }}</span>
          </span>
          <Check class="size-4 shrink-0 text-primary opacity-0" />
        </button>

        <button
          v-if="canCreate"
          type="button"
          role="option"
          :aria-selected="highlightedIndex === suggestions.length"
          class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          :class="highlightedIndex === suggestions.length ? 'bg-accent' : ''"
          @mouseenter="highlightedIndex = suggestions.length"
          @click="pick(modelValue)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <Plus class="size-4 shrink-0 text-primary" />
            <span class="truncate">Create #{{ modelValue.trim().replace(/^#+/, '') }}</span>
          </span>
        </button>

        <div v-if="suggestions.length === 0 && !canCreate" class="px-2 py-3 text-center text-xs text-muted-foreground">
          No matching tags
        </div>
      </div>
    </Transition>
  </div>
</template>

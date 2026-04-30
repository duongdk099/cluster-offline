<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';
import { Check, ChevronDown, FolderOpen } from 'lucide-vue-next';
import type { NoteFolder } from '~/types/notes';

const props = withDefaults(defineProps<{
  folders: NoteFolder[];
  modelValue: string | null;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  placeholder: 'No folder',
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);

const selected = computed(() => props.folders.find((f) => f.id === props.modelValue) ?? null);

onClickOutside(menuRef, () => {
  open.value = false;
}, { ignore: [triggerRef] });

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}

function pick(folderId: string | null) {
  emit('update:modelValue', folderId);
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false;
    (triggerRef.value as HTMLElement | null)?.focus?.();
  }
}
</script>

<template>
  <div class="relative" @keydown="onKeydown">
    <button
      ref="triggerRef"
      type="button"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :title="selected ? `Folder: ${selected.name}` : placeholder"
      class="inline-flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      @click="toggle"
    >
      <FolderOpen class="size-4" />
      <span class="max-w-[180px] truncate text-foreground">
        {{ selected?.name ?? placeholder }}
      </span>
      <ChevronDown
        class="size-4 transition-transform duration-150"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="open"
        ref="menuRef"
        role="listbox"
        class="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 origin-top-left overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg outline-none scrollbar-thin"
      >
        <button
          type="button"
          role="option"
          :aria-selected="modelValue === null"
          class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          @click="pick(null)"
        >
          <span class="text-muted-foreground">No folder</span>
          <Check v-if="modelValue === null" class="size-4 text-primary" />
        </button>

        <div v-if="folders.length > 0" class="my-1 border-t" />

        <button
          v-for="folder in folders"
          :key="folder.id"
          type="button"
          role="option"
          :aria-selected="modelValue === folder.id"
          class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          @click="pick(folder.id)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <FolderOpen class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ folder.name }}</span>
          </span>
          <Check v-if="modelValue === folder.id" class="size-4 shrink-0 text-primary" />
        </button>

        <div v-if="folders.length === 0" class="px-2 py-3 text-center text-xs text-muted-foreground">
          No folders yet
        </div>
      </div>
    </Transition>
  </div>
</template>

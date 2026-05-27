<script setup lang="ts">
import { FileText, Loader2, Plus, Search, Trash2 } from 'lucide-vue-next';
import { Kbd } from '~/components/ui/kbd';

const open = defineModel<boolean>('open', { default: false });

const router = useRouter();
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const { data: notes, isLoading } = useNotes();

const filteredNotes = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  const source = notes.value ?? [];
  if (!normalized) return source.slice(0, 8);

  return source
    .filter((note) => {
      const title = note.title || 'Untitled';
      return title.toLowerCase().includes(normalized)
        || (note.contentText ?? '').toLowerCase().includes(normalized)
        || (note.tags ?? []).some((tag) => tag.name.toLowerCase().includes(normalized));
    })
    .slice(0, 8);
});

watch(open, async (nextOpen) => {
  if (!nextOpen) {
    query.value = '';
    return;
  }
  await nextTick();
  inputRef.value?.focus();
});

function closeAndNavigate(path: string) {
  open.value = false;
  void router.push(path);
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    open.value = !open.value;
    return;
  }

  if (event.key === 'Escape') {
    open.value = false;
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 bg-background/80 p-3 backdrop-blur-sm" @click.self="open = false">
      <div class="mx-auto mt-[12vh] w-full max-w-xl overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl">
        <div class="flex h-12 items-center gap-3 border-b px-3">
          <Search class="size-4 text-muted-foreground" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Search notes or run an action"
            class="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          >
          <Kbd>Esc</Kbd>
        </div>

        <div class="max-h-[420px] overflow-y-auto p-2 scrollbar-thin">
          <p class="px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Actions
          </p>
          <button
            type="button"
            class="flex h-10 w-full items-center justify-between rounded-md px-2 text-sm hover:bg-accent"
            @click="closeAndNavigate('/notes/new')"
          >
            <span class="flex items-center gap-2"><Plus class="size-4" /> New note</span>
            <Kbd>N</Kbd>
          </button>
          <button
            type="button"
            class="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-accent"
            @click="closeAndNavigate('/notes/deleted')"
          >
            <Trash2 class="size-4" />
            Open trash
          </button>

          <div class="my-2 h-px bg-border" />

          <p class="px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <div v-if="isLoading" class="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" />
            Loading notes
          </div>
          <div v-else-if="filteredNotes.length === 0" class="px-2 py-3 text-sm text-muted-foreground">
            No notes found.
          </div>
          <button
            v-for="note in filteredNotes"
            :key="note.id"
            type="button"
            class="flex h-10 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent"
            @click="closeAndNavigate(`/notes/${note.id}`)"
          >
            <FileText class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ note.title || 'Untitled' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

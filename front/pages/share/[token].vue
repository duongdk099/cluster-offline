<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';

definePageMeta({ layout: false });

const route = useRoute();
const token = computed(() => String(route.params.token));
const config = useRuntimeConfig();
const apiBase = String(config.public.apiUrl || 'http://localhost:3001').replace(/\/$/, '');

const { data: note, error, pending } = await useFetch<{
  id: string;
  title: string;
  content: unknown;
  contentText: string;
  createdAt: string;
  updatedAt: string;
}>(`${apiBase}/share/${token.value}`, { server: false });

const editor = useEditor({
  editable: false,
  immediatelyRender: false,
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({ inline: true, allowBase64: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ],
  content: '',
  editorProps: {
    attributes: {
      class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none',
    },
  },
});

watch(note, (n) => {
  if (n && editor.value) {
    editor.value.commands.setContent(n.content as Record<string, unknown> | string);
  }
}, { immediate: true });

onBeforeUnmount(() => editor.value?.destroy());
</script>

<template>
  <div class="min-h-screen bg-background text-foreground antialiased">
    <header class="border-b">
      <div class="mx-auto flex h-12 max-w-3xl items-center px-6 text-xs text-muted-foreground">
        <span class="font-mono uppercase tracking-wide">NotesAides · Shared</span>
      </div>
    </header>
    <main class="mx-auto max-w-3xl p-6 md:p-10">
      <div v-if="pending" class="text-sm text-muted-foreground">Loading…</div>
      <div v-else-if="error || !note" class="space-y-2 text-center">
        <h1 class="text-2xl font-semibold">Link not found</h1>
        <p class="text-sm text-muted-foreground">This share link is no longer valid.</p>
      </div>
      <div v-else>
        <h1 class="mb-2 text-3xl font-semibold tracking-tight">
          {{ note.title || 'Untitled' }}
        </h1>
        <p class="mb-6 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Shared
        </p>
        <EditorContent :editor="editor" />
      </div>
    </main>
  </div>
</template>

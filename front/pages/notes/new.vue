<script setup lang="ts">
import type { JSONContent } from '@tiptap/core';
import { toast } from 'vue-sonner';

const router = useRouter();
const createNote = useCreateNote();

async function handleSave(data: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) {
  try {
    const note = await createNote.mutateAsync(data);
    toast.success('Note created');
    void router.push(`/notes/${note.id}`);
  } catch (error) {
    toast.error('Failed to create note', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}
</script>

<template>
  <MainEditor
    :key="'new'"
    :note="null"
    :is-pending="createNote.isPending.value"
    @save="handleSave"
  />
</template>

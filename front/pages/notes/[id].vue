<script setup lang="ts">
import type { JSONContent } from '@tiptap/core';
import { toast } from 'vue-sonner';

// Force the page component to re-mount on every note id change so
// the global <NuxtPage :transition="page"> animation fires when
// navigating from one note to another.
definePageMeta({
  key: (route) => route.fullPath,
});

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const { data: note } = useNote(id);
const updateNote = useUpdateNote();
const deleteNote = useDeleteNote();

function handleSave(data: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) {
  updateNote.mutate(
    { id: id.value, ...data },
    {
      onError: (error) => {
        toast.error('Failed to save note', {
          description: error instanceof Error ? error.message : undefined,
        });
      },
    },
  );
}

async function handleDelete() {
  try {
    await deleteNote.mutateAsync(id.value);
    toast.success('Note moved to trash');
    void router.push('/');
  } catch (error) {
    toast.error('Failed to delete note', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}
</script>

<template>
  <MainEditor
    :key="id"
    :note="note"
    :is-pending="updateNote.isPending.value"
    @save="handleSave"
    @delete="handleDelete"
  />
</template>

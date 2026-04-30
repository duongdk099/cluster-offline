<script setup lang="ts">
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { formatRelativeTime } from '~/utils/notes';

const { data: deletedNotes, isLoading, isError } = useDeletedNotes();
const restoreNote = useRestoreNote();
const permanentDeleteNote = usePermanentDeleteNote();
const pendingDelete = ref<{ type: 'single'; id: string } | { type: 'empty' } | null>(null);

const notes = computed(() => deletedNotes.value ?? []);

function handleRestore(id: string) {
  restoreNote.mutate(id, {
    onSuccess: () => {
      toast.success('Note restored');
    },
    onError: (error) => {
      toast.error('Failed to restore note', {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });
}

async function confirmPermanentDelete() {
  const action = pendingDelete.value;
  if (!action) return;

  try {
    if (action.type === 'single') {
      await permanentDeleteNote.mutateAsync(action.id);
      toast.success('Note deleted permanently');
    } else {
      await Promise.all(notes.value.map((note) => permanentDeleteNote.mutateAsync(note.id)));
      toast.success('Trash emptied');
    }
  } catch (error) {
    toast.error('Failed to delete note', {
      description: error instanceof Error ? error.message : undefined,
    });
  } finally {
    pendingDelete.value = null;
  }
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <PageHeader
      title="Trash"
      :description="`${notes.length} deleted note${notes.length === 1 ? '' : 's'}`"
    >
      <template #actions>
        <Button
          v-if="notes.length > 0"
          variant="destructive"
          size="sm"
          @click="pendingDelete = { type: 'empty' }"
        >
          <Trash2 class="size-4" />
          Empty trash
        </Button>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin md:p-6">
      <div class="overflow-hidden rounded-lg border bg-card">
        <div v-if="isLoading" class="space-y-2 p-4">
          <Skeleton v-for="i in 6" :key="i" class="h-11 w-full" />
        </div>

        <EmptyState
          v-else-if="isError"
          :icon="AlertTriangle"
          title="Failed to load trash"
          description="Refresh the page or try again in a moment."
        />

        <EmptyState
          v-else-if="notes.length === 0"
          :icon="Trash2"
          title="Trash is empty"
          description="Deleted notes will appear here before permanent deletion."
        />

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-medium">Title</th>
                <th class="px-4 py-3 font-medium">Deleted</th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="note in notes" :key="note.id" class="border-b last:border-b-0 hover:bg-accent/50">
                <td class="max-w-[320px] px-4 py-3">
                  <span class="block truncate font-medium">{{ note.title || 'Untitled' }}</span>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {{ note.deletedAt ? formatRelativeTime(note.deletedAt) : 'Recently' }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="restoreNote.isPending.value"
                      @click="handleRestore(note.id)"
                    >
                      <RotateCcw class="size-4" />
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      :disabled="permanentDeleteNote.isPending.value"
                      @click="pendingDelete = { type: 'single', id: note.id }"
                    >
                      <Trash2 class="size-4" />
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="pendingDelete"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        @click.self="pendingDelete = null"
      >
        <div class="w-full max-w-md rounded-lg border bg-popover p-6 text-popover-foreground shadow-xl">
          <div class="space-y-2">
            <h2 class="text-lg font-semibold">
              {{ pendingDelete.type === 'empty' ? 'Empty trash permanently?' : 'Delete this note permanently?' }}
            </h2>
            <p class="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <Button variant="ghost" @click="pendingDelete = null">
              Cancel
            </Button>
            <Button
              variant="destructive"
              :disabled="permanentDeleteNote.isPending.value"
              @click="confirmPermanentDelete"
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

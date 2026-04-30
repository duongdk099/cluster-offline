<script setup lang="ts">
import { Calendar, Clock, FileText, Plus } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import type { Note } from '~/types/notes';
import { extractFirstImage, formatRelativeTime, stripHtml } from '~/utils/notes';

type OverviewFilter = 'all' | 'week' | 'today';

const props = defineProps<{
  notes: Note[];
  activeFilter?: OverviewFilter;
}>();

const emit = defineEmits<{
  select: [note: Note];
  newNote: [];
  filter: [filter: OverviewFilter];
}>();

const todayCount = computed(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return props.notes.filter((note) => new Date(note.createdAt) >= todayStart).length;
});

const weekCount = computed(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  return props.notes.filter((note) => new Date(note.createdAt) >= weekStart).length;
});

const recentNotes = computed(() => props.notes.slice(0, 6));

const stats = computed(() => [
  { label: 'Total', value: props.notes.length, icon: FileText, filter: 'all' as const },
  { label: 'This week', value: weekCount.value, icon: Calendar, filter: 'week' as const },
  { label: 'Today', value: todayCount.value, icon: Clock, filter: 'today' as const },
]);
</script>

<template>
  <div v-if="notes.length === 0" class="h-full">
    <EmptyState
      :icon="FileText"
      title="No notes yet"
      description="Create your first note to get started."
    >
      <Button @click="emit('newNote')">
        <Plus class="size-4" />
        New note
      </Button>
    </EmptyState>
  </div>

  <div v-else class="space-y-6">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <button
        v-for="stat in stats"
        :key="stat.label"
        type="button"
        class="rounded-lg border bg-card p-4 text-left text-card-foreground transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="(activeFilter ?? 'all') === stat.filter ? 'border-primary bg-accent/70' : ''"
        :aria-pressed="(activeFilter ?? 'all') === stat.filter"
        @click="emit('filter', stat.filter)"
      >
        <div class="flex items-center gap-3">
          <div class="flex size-9 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <component :is="stat.icon" class="size-4" />
          </div>
          <div>
            <p class="text-2xl font-semibold tracking-tight">
              {{ stat.value }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ stat.label }}
            </p>
          </div>
        </div>
      </button>
    </div>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium">
          Recent notes
        </h2>
        <Button variant="ghost" size="sm" @click="emit('newNote')">
          <Plus class="size-4" />
          New
        </Button>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="note in recentNotes"
          :key="note.id"
          type="button"
          class="overflow-hidden rounded-md border bg-card text-left text-card-foreground transition-colors hover:bg-accent/60"
          @click="emit('select', note)"
        >
          <div
            v-if="extractFirstImage(note.content)"
            class="h-28 border-b bg-cover bg-center"
            :style="{ backgroundImage: `url(${extractFirstImage(note.content)})` }"
          />
          <div class="space-y-2 p-4">
            <div class="flex items-center gap-2">
              <h3 class="truncate text-sm font-medium">
                {{ note.title || 'Untitled' }}
              </h3>
              <span class="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                {{ formatRelativeTime(note.updatedAt ?? note.createdAt) }}
              </span>
            </div>
            <p class="line-clamp-2 text-xs leading-5 text-muted-foreground">
              {{ stripHtml(note.content) || 'No additional text' }}
            </p>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, FileText, LayoutGrid, List, SearchX, X } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import type { Note } from '~/types/notes';

const props = withDefaults(defineProps<{
  notes?: Note[];
  isLoading: boolean;
  isError: boolean;
  selectedId?: string;
  searchQuery?: string;
  viewMode?: 'list' | 'grid';
  title?: string;
}>(), {
  notes: () => [],
  selectedId: '',
  searchQuery: '',
  viewMode: 'list',
  title: 'Notes',
});

const emit = defineEmits<{
  select: [note: Note];
  clearSearch: [];
  'update:viewMode': [mode: 'list' | 'grid'];
}>();

const hasSearchQuery = computed(() => props.searchQuery.trim().length > 0);
const showNoResults = computed(() => hasSearchQuery.value && props.notes.length === 0);

function handleDragStart(event: DragEvent, note: Note) {
  if (!event.dataTransfer) return;

  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', note.id);
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <div class="flex min-h-12 items-center justify-between border-b px-4">
      <div class="min-w-0">
        <h2 class="text-sm font-medium">
          {{ hasSearchQuery ? 'Search results' : title }}
        </h2>
        <p class="font-mono text-[11px] text-muted-foreground">
          {{ notes.length }} item{{ notes.length === 1 ? '' : 's' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-md border bg-background p-0.5">
          <Button
            variant="ghost"
            size="icon"
            :class="viewMode === 'list' ? 'bg-accent' : ''"
            :aria-pressed="viewMode === 'list'"
            aria-label="List view"
            @click="emit('update:viewMode', 'list')"
          >
            <List class="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :class="viewMode === 'grid' ? 'bg-accent' : ''"
            :aria-pressed="viewMode === 'grid'"
            aria-label="Grid view"
            @click="emit('update:viewMode', 'grid')"
          >
            <LayoutGrid class="size-4" />
          </Button>
        </div>
        <Button
          v-if="hasSearchQuery"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          @click="emit('clearSearch')"
        >
          <X class="size-4" />
        </Button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
      <div v-if="isLoading" class="space-y-2">
        <Skeleton v-for="i in 6" :key="i" class="h-20 w-full" />
      </div>

      <EmptyState
        v-else-if="isError"
        :icon="AlertTriangle"
        title="Failed to load notes"
        description="Refresh the page or try again in a moment."
      />

      <EmptyState
        v-else-if="showNoResults"
        :icon="SearchX"
        title="No results found"
        description="Try a different search term or clear the current query."
      >
        <Button variant="outline" size="sm" @click="emit('clearSearch')">
          Clear search
        </Button>
      </EmptyState>

      <EmptyState
        v-else-if="notes.length === 0"
        :icon="FileText"
        title="No notes yet"
        description="Create your first note to start the workspace."
      />

      <div
        v-else
        :class="viewMode === 'grid'
          ? 'grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3'
          : 'space-y-2'"
      >
        <NoteCard
          v-for="note in notes"
          :key="note.id"
          :note="note"
          :is-active="selectedId === note.id"
          @select="emit('select', note)"
          @dragstart="handleDragStart"
        />
      </div>
    </div>
  </section>
</template>

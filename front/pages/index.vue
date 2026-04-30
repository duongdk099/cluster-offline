<script setup lang="ts">
import { Plus, Search } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import type { Note } from '~/types/notes';

const router = useRouter();
const route = useRoute();

const searchQuery = ref('');
const viewMode = ref<'list' | 'grid'>('list');
const overviewFilter = ref<'all' | 'week' | 'today'>('all');

const selectedTag = computed(() => typeof route.query.tag === 'string' ? route.query.tag : '');
const selectedFolder = computed(() => typeof route.query.folder === 'string' ? route.query.folder : '');
const hasSidebarFilter = computed(() => !!selectedTag.value || !!selectedFolder.value);
const filters = computed(() => ({
  tag: selectedTag.value || undefined,
  folder: selectedFolder.value || undefined,
}));

const allNotesQuery = useNotes(filters);
const searchResultsQuery = useSearchNotes(searchQuery, filters);
const normalizedSearchQuery = computed(() => searchQuery.value.trim());
const isSearchActive = computed(() => normalizedSearchQuery.value.length > 0);

const allNotes = computed(() => allNotesQuery.data.value ?? []);
const baseNotes = computed(() => isSearchActive.value ? (searchResultsQuery.data.value ?? []) : allNotes.value);
const notes = computed(() => filterByOverviewRange(baseNotes.value));
const isNotesLoading = computed(() => isSearchActive.value ? searchResultsQuery.isLoading.value : allNotesQuery.isLoading.value);
const isNotesError = computed(() => isSearchActive.value ? searchResultsQuery.isError.value : allNotesQuery.isError.value);
const visibleListTitle = computed(() => {
  if (isSearchActive.value) return 'Search results';
  if (hasSidebarFilter.value) return 'Notes';
  if (overviewFilter.value === 'today') return 'Today';
  if (overviewFilter.value === 'week') return 'This week';
  return 'Notes';
});

const pageTitle = computed(() => {
  if (selectedTag.value) return 'Filtered notes';
  if (selectedFolder.value) return 'Folder notes';
  return 'All notes';
});

const pageDescription = computed(() => {
  if (isSearchActive.value) return `Search results for "${normalizedSearchQuery.value}"`;
  if (hasSidebarFilter.value) return 'Showing the current sidebar filter.';
  if (overviewFilter.value === 'today') return 'Showing notes created today.';
  if (overviewFilter.value === 'week') return 'Showing notes created in the last 7 days.';
  return 'A dense workspace for recent notes and fast capture.';
});

function filterByOverviewRange(sourceNotes: Note[]) {
  if (isSearchActive.value || hasSidebarFilter.value || overviewFilter.value === 'all') {
    return sourceNotes;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeStart = new Date(todayStart);

  if (overviewFilter.value === 'week') {
    rangeStart.setDate(rangeStart.getDate() - 6);
    return sourceNotes.filter((note) => new Date(note.createdAt) >= rangeStart);
  }

  return sourceNotes.filter((note) => new Date(note.createdAt) >= todayStart);
}

function goToNote(note: Note) {
  void router.push(`/notes/${note.id}`);
}

function newNote() {
  void router.push('/notes/new');
}

// A reactive key that changes whenever the visible result set changes
// (sidebar filter, search query, scope). Keying the body wrapper makes
// Vue play the page-style transition on every filter change too,
// not just on full route changes.
const viewKey = computed(() =>
  `${selectedTag.value}::${selectedFolder.value}::${normalizedSearchQuery.value}::${overviewFilter.value}`,
);

// Show the loading bar briefly when filters change so the experience
// matches a real navigation, even though we stay on the same route.
const loading = useLoadingIndicator();
watch(viewKey, () => {
  loading.start();
  setTimeout(() => loading.finish(), 240);
});
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <PageHeader :title="pageTitle" :description="pageDescription">
      <template #actions>
        <div class="relative hidden sm:block">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search notes"
            class="h-9 w-64 rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
        </div>
        <Button @click="newNote">
          <Plus class="size-4" />
          New
        </Button>
      </template>
    </PageHeader>

    <div class="border-b p-3 sm:hidden">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search notes"
          class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin md:p-6">
      <Transition name="page" mode="out-in">
        <div :key="viewKey" class="will-change-[opacity,transform]">
          <div v-if="!isSearchActive && !hasSidebarFilter" class="space-y-6">
            <NotesOverview
              :notes="allNotes"
              :active-filter="overviewFilter"
              @select="goToNote"
              @new-note="newNote"
              @filter="overviewFilter = $event"
            />

            <div v-if="allNotes.length > 0" class="min-h-115 overflow-hidden rounded-lg border bg-card">
              <NoteList
                :notes="notes"
                :is-loading="isNotesLoading"
                :is-error="isNotesError"
                :search-query="searchQuery"
                :view-mode="viewMode"
                :title="visibleListTitle"
                @select="goToNote"
                @clear-search="searchQuery = ''"
                @update:view-mode="viewMode = $event"
              />
            </div>
          </div>

          <div v-else class="h-full min-h-115 overflow-hidden rounded-lg border bg-card">
            <NoteList
              :notes="notes"
              :is-loading="isNotesLoading"
              :is-error="isNotesError"
              :search-query="searchQuery"
              :view-mode="viewMode"
              :title="visibleListTitle"
              @select="goToNote"
              @clear-search="searchQuery = ''"
              @update:view-mode="viewMode = $event"
            />
          </div>
        </div>
      </Transition>
    </div>
  </section>
</template>

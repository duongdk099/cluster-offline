<script setup lang="ts">
import {
  Folder,
  FolderOpen,
  Inbox,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Tags,
  Trash2,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '~/components/ui/button';

const props = withDefaults(defineProps<{
  mobile?: boolean;
}>(), {
  mobile: false,
});

const collapsed = defineModel<boolean>('collapsed', { default: false });

const emit = defineEmits<{
  newNote: [];
  logout: [];
  close: [];
}>();

const router = useRouter();
const route = useRoute();
const newFolderName = ref('');
const dragOverFolderId = ref<string | null>(null);

const { data: deletedNotes } = useDeletedNotes();
const { data: tags } = useTags();
const { data: folders } = useFolders();
const createFolder = useCreateFolder();
const assignFolderToNote = useAssignFolderToNote();

const selectedTag = computed(() => typeof route.query.tag === 'string' ? route.query.tag : '');
const selectedFolder = computed(() => typeof route.query.folder === 'string' ? route.query.folder : '');
const isCollapsed = computed(() => collapsed.value && !props.mobile);
const deletedCount = computed(() => deletedNotes.value?.length ?? 0);

function navItemClass(active = false, dropTarget = false) {
  return [
    'group flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-all duration-150',
    isCollapsed.value ? 'justify-center' : 'justify-between',
    active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    dropTarget ? 'scale-[1.02] bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-sm' : '',
  ];
}

function handleDragOver(folderId: string, event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  if (dragOverFolderId.value !== folderId) dragOverFolderId.value = folderId;
}

function handleDragLeave(folderId: string, event: DragEvent) {
  // Ignore leave when entering a child element of the same target.
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as Node).contains(next)) return;
  if (dragOverFolderId.value === folderId) dragOverFolderId.value = null;
}

function resetFilters() {
  emit('close');
  void router.push('/');
}

function selectTag(tagId: string) {
  emit('close');
  if (selectedTag.value === tagId) {
    void router.push('/');
    return;
  }
  void router.push({ path: '/', query: { tag: tagId } });
}

function selectFolder(folderId: string) {
  emit('close');
  if (selectedFolder.value === folderId) {
    void router.push('/');
    return;
  }
  void router.push({ path: '/', query: { folder: folderId } });
}

async function handleCreateFolder() {
  const trimmed = newFolderName.value.trim();
  if (!trimmed) return;

  try {
    await createFolder.mutateAsync({ name: trimmed });
    newFolderName.value = '';
    toast.success('Folder created');
  } catch (error) {
    toast.error('Failed to create folder', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

async function handleDropOnFolder(folderId: string, event: DragEvent) {
  event.preventDefault();
  dragOverFolderId.value = null;

  const noteId = event.dataTransfer?.getData('text/plain');
  if (!noteId) return;

  try {
    await assignFolderToNote.mutateAsync({ id: noteId, folderId });
    toast.success('Note moved');
  } catch (error) {
    toast.error('Failed to move note', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}
</script>

<template>
  <aside
    class="flex h-full shrink-0 flex-col border-r bg-background transition-[width] duration-200"
    :class="isCollapsed ? 'w-14' : 'w-64'"
  >
    <div class="flex h-12 items-center justify-between border-b px-3">
      <span v-if="!isCollapsed" class="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Workspace
      </span>
      <Button
        v-if="!mobile"
        variant="ghost"
        size="icon"
        :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        aria-label="Toggle sidebar"
        @click="collapsed = !collapsed"
      >
        <PanelLeftOpen v-if="isCollapsed" class="size-4" />
        <PanelLeftClose v-else class="size-4" />
      </Button>
    </div>

    <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
      <div class="space-y-5">
        <section class="space-y-1">
          <p v-if="!isCollapsed" class="px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Library
          </p>
          <button
            type="button"
            :class="navItemClass(route.path === '/' && !selectedTag && !selectedFolder)"
            title="All notes"
            @click="resetFilters"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Inbox class="size-4" />
              <span v-if="!isCollapsed" class="truncate">All notes</span>
            </span>
          </button>
          <NuxtLink to="/notes/deleted" @click="emit('close')">
            <button
              type="button"
              :class="navItemClass(route.path === '/notes/deleted')"
              title="Trash"
            >
              <span class="flex min-w-0 items-center gap-2">
                <Trash2 class="size-4" />
                <span v-if="!isCollapsed" class="truncate">Trash</span>
              </span>
              <span v-if="!isCollapsed && deletedCount > 0" class="font-mono text-xs text-muted-foreground">
                {{ deletedCount }}
              </span>
            </button>
          </NuxtLink>
        </section>

        <section class="space-y-1">
          <p v-if="!isCollapsed" class="px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tags
          </p>
          <div v-if="(tags ?? []).length === 0 && !isCollapsed" class="px-2 py-1 text-xs text-muted-foreground">
            No tags yet
          </div>
          <button
            v-for="tag in tags ?? []"
            :key="tag.id"
            type="button"
            :class="navItemClass(selectedTag === tag.id)"
            :title="`#${tag.name}`"
            @click="selectTag(tag.id)"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Tags class="size-4" />
              <span v-if="!isCollapsed" class="truncate">#{{ tag.name }}</span>
            </span>
          </button>
        </section>

        <section class="space-y-1">
          <p v-if="!isCollapsed" class="px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Folders
          </p>
          <div v-if="(folders ?? []).length === 0 && !isCollapsed" class="px-2 py-1 text-xs text-muted-foreground">
            No folders yet
          </div>
          <button
            v-for="folder in folders ?? []"
            :key="folder.id"
            type="button"
            :class="navItemClass(selectedFolder === folder.id, dragOverFolderId === folder.id)"
            :title="folder.name"
            :data-drop-target="dragOverFolderId === folder.id ? 'true' : undefined"
            @click="selectFolder(folder.id)"
            @dragenter.prevent="handleDragOver(folder.id, $event)"
            @dragover.prevent="handleDragOver(folder.id, $event)"
            @dragleave="handleDragLeave(folder.id, $event)"
            @drop="handleDropOnFolder(folder.id, $event)"
          >
            <span class="flex min-w-0 items-center gap-2">
              <FolderOpen
                v-if="dragOverFolderId === folder.id"
                class="size-4 animate-[wiggle_0.4s_ease-in-out_infinite] text-primary"
              />
              <Folder
                v-else
                class="size-4 transition-transform"
              />
              <span v-if="!isCollapsed" class="truncate">{{ folder.name }}</span>
            </span>
            <span
              v-if="dragOverFolderId === folder.id && !isCollapsed"
              class="font-mono text-[10px] uppercase tracking-wide text-primary"
            >
              Drop
            </span>
          </button>

          <form v-if="!isCollapsed" class="mt-2 flex items-center gap-1.5" @submit.prevent="handleCreateFolder">
            <input
              v-model="newFolderName"
              type="text"
              placeholder="New folder"
              class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
            <Button type="submit" size="icon" variant="outline" aria-label="Create folder" :disabled="createFolder.isPending.value">
              <Plus class="size-4" />
            </Button>
          </form>
        </section>
      </div>
    </div>

    <div class="border-t p-2">
      <Button
        class="w-full"
        :size="isCollapsed ? 'icon' : 'sm'"
        variant="secondary"
        title="New note"
        @click="emit('newNote'); emit('close')"
      >
        <Plus class="size-4" />
        <span v-if="!isCollapsed">New note</span>
      </Button>
      <Button
        class="mt-1 w-full"
        :size="isCollapsed ? 'icon' : 'sm'"
        variant="ghost"
        title="Log out"
        @click="emit('logout'); emit('close')"
      >
        <LogOut class="size-4" />
        <span v-if="!isCollapsed">Log out</span>
      </Button>
    </div>
  </aside>
</template>

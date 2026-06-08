<script setup lang="ts">
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent } from '@tiptap/vue-3';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  FileText,
  Plus,
  Share,
  Trash2,
  X,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import type { Note } from '~/types/notes';
import { stripHtml } from '~/utils/notes';

const props = withDefaults(defineProps<{
  note?: Note | null;
  isPending?: boolean;
}>(), {
  note: undefined,
  isPending: false,
});

const emit = defineEmits<{
  save: [note: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }];
  delete: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isTagComposerOpen = ref(false);
const deleteDialogOpen = ref(false);
const isTagDropOver = ref(false);

const { data: folders } = useFolders();
const { data: availableTags } = useTags();
const {
  editor,
  title,
  tags,
  tagInput,
  folderId,
  saveStatus,
  handleTitleChange,
  handleTagInputChange,
  handleAddTag,
  handleRemoveTag,
  handleFolderChange,
  handleFileUpload,
} = useNoteEditor({
  note: toRef(props, 'note'),
  isPending: toRef(props, 'isPending'),
  onSave: (data) => emit('save', data),
});

const createdAtDate = computed(() => props.note?.createdAt ? new Date(props.note.createdAt) : null);
const createdAtLabel = computed(() => {
  if (!createdAtDate.value) return 'Draft';

  return createdAtDate.value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});
const selectedFolder = computed(() => (folders.value ?? []).find((folder) => folder.id === folderId.value) ?? null);
const pageTitle = computed(() => title.value.trim() || (props.note === null ? 'New note' : 'Untitled'));
const editorText = computed(() => editor.value?.getText() ?? stripHtml(props.note?.content ?? ''));
const wordCount = computed(() => editorText.value.trim() ? editorText.value.trim().split(/\s+/).length : 0);
const shouldShowImageMenu = ({ editor }: { editor: Editor }) => editor.isActive('image');

watch(() => props.note?.id, () => {
  isTagComposerOpen.value = false;
});

function commitTagComposer(rawTagInput = tagInput.value) {
  const didAddTag = handleAddTag(rawTagInput);
  isTagComposerOpen.value = false;
  return didAddTag;
}

function cancelTagComposer() {
  handleTagInputChange('');
  isTagComposerOpen.value = false;
}

function confirmDelete() {
  deleteDialogOpen.value = false;
  emit('delete');
}

function hasTagDrag(event: DragEvent): boolean {
  return !!event.dataTransfer?.types.includes('application/x-notesaides-tag');
}

function onTagDragOver(event: DragEvent) {
  if (!hasTagDrag(event)) return;
  event.preventDefault();
  isTagDropOver.value = true;
}

function onTagDragLeave(event: DragEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as Node).contains(next)) return;
  isTagDropOver.value = false;
}

function onTagDrop(event: DragEvent) {
  isTagDropOver.value = false;
  if (!hasTagDrag(event)) return;
  if (!props.note?.id) return;

  let tag: { id: string; name: string };
  try {
    tag = JSON.parse(event.dataTransfer!.getData('application/x-notesaides-tag'));
  } catch {
    toast.error('Failed to read tag data');
    return;
  }

  const alreadyHasTag = tags.value.some(
    (t) => t.toLowerCase() === tag.name.toLowerCase(),
  );
  if (alreadyHasTag) return;

  handleAddTag(tag.name);
  toast.success(`Tag #${tag.name} added`);
}
</script>

<template>
  <div v-if="note === undefined" class="flex h-full min-h-0 flex-col">
    <div class="space-y-3 border-b p-4 md:p-6">
      <Skeleton class="h-5 w-40" />
      <Skeleton class="h-9 w-full max-w-xl" />
    </div>
    <div class="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4 md:p-8">
      <Skeleton class="h-12 w-3/4" />
      <Skeleton class="h-5 w-56" />
      <Skeleton class="h-80 w-full" />
    </div>
  </div>

  <div v-else class="flex h-full min-h-0 flex-col bg-background">
    <header class="shrink-0 border-b bg-background">
      <div class="flex flex-col gap-3 px-4 py-3 md:px-6">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              <NuxtLink to="/" class="hover:text-foreground">Notes</NuxtLink>
              <span>/</span>
              <span class="truncate">{{ pageTitle }}</span>
            </div>
            <h1 class="mt-1 truncate text-lg font-semibold tracking-tight">
              {{ pageTitle }}
            </h1>
          </div>

          <StatusBadge :status="saveStatus" :created-at="note?.createdAt" :updated-at="note?.updatedAt" />

          <div class="flex items-center gap-1">
            <AIPanel
              v-if="note?.id"
              :note-id="note.id"
              @add-tag="(name) => handleAddTag(name)"
            />
            <Button variant="ghost" size="icon" title="Share">
              <Share class="size-4" />
            </Button>
            <Button
              v-if="note"
              variant="ghost"
              size="icon"
              title="Delete"
              @click="deleteDialogOpen = true"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>

        <EditorToolbar :editor="editor" @add-image="fileInputRef?.click()" />
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
      <div class="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
        <div class="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span class="font-mono">{{ createdAtLabel }}</span>
          <span class="h-1 w-1 rounded-full bg-muted-foreground/60" />
          <span>{{ wordCount }} words</span>
        </div>

        <input
          type="text"
          placeholder="Untitled"
          :value="title"
          class="mb-4 w-full bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground md:text-5xl"
          @input="handleTitleChange(($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="editor?.commands.focus()"
        >

        <div
          class="mb-8 flex flex-wrap items-center gap-2"
          :class="isTagDropOver ? 'rounded-md ring-2 ring-primary/40 ring-offset-2 ring-offset-background' : ''"
          @dragenter="onTagDragOver"
          @dragover.prevent="onTagDragOver"
          @dragleave="onTagDragLeave"
          @drop.prevent="onTagDrop"
        >
          <FolderPicker
            :folders="folders ?? []"
            :model-value="folderId"
            @update:model-value="handleFolderChange"
          />

          <button
            v-for="tag in tags"
            :key="tag"
            type="button"
            :title="`Remove #${tag}`"
            @click="handleRemoveTag(tag)"
          >
            <Badge variant="secondary" class="gap-1.5">
              #{{ tag }}
              <X class="size-3" />
            </Badge>
          </button>

          <TagSuggestionInput
            v-if="isTagComposerOpen"
            :available-tags="availableTags ?? []"
            :selected-tags="tags"
            :model-value="tagInput"
            @update:model-value="handleTagInputChange"
            @add="commitTagComposer"
            @cancel="cancelTagComposer"
          />

          <Button v-else variant="outline" size="sm" @click="isTagComposerOpen = true">
            <Plus class="size-4" />
            Tag
          </Button>
        </div>

        <div class="min-h-[58vh]">
          <BubbleMenu
            v-if="editor"
            :editor="editor"
            :should-show="shouldShowImageMenu"
          >
            <div class="flex items-center gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
              <Button
                variant="ghost"
                size="icon"
                title="Align left"
                :class="editor.isActive({ textAlign: 'left' }) ? 'bg-accent' : ''"
                @click="editor.chain().focus().setTextAlign('left').run()"
              >
                <AlignLeft class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Align center"
                :class="editor.isActive({ textAlign: 'center' }) ? 'bg-accent' : ''"
                @click="editor.chain().focus().setTextAlign('center').run()"
              >
                <AlignCenter class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Align right"
                :class="editor.isActive({ textAlign: 'right' }) ? 'bg-accent' : ''"
                @click="editor.chain().focus().setTextAlign('right').run()"
              >
                <AlignRight class="size-4" />
              </Button>
            </div>
          </BubbleMenu>

          <EditorContent :editor="editor" />

          <EmptyState
            v-if="!editor"
            :icon="FileText"
            title="Editor unavailable"
            description="The editor could not initialize in this session."
          />
        </div>
      </div>
    </main>

    <EditorStatusBar :folder-name="selectedFolder?.name" :tags="tags" :word-count="wordCount" />

    <Teleport to="body">
      <div
        v-if="deleteDialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        @click.self="deleteDialogOpen = false"
      >
        <div class="w-full max-w-md rounded-lg border bg-popover p-6 text-popover-foreground shadow-xl">
          <div class="space-y-2">
            <h2 class="text-lg font-semibold">Delete this note?</h2>
            <p class="text-sm text-muted-foreground">
              The note will move to trash and can be restored later.
            </p>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <Button variant="ghost" @click="deleteDialogOpen = false">
              Cancel
            </Button>
            <Button variant="destructive" @click="confirmDelete">
              Delete
            </Button>
          </div>
        </div>
      </div>
    </Teleport>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept="image/*"
      @change="(event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) handleFileUpload(file);
        input.value = '';
      }"
    >
  </div>
</template>

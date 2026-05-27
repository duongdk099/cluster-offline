import type { Editor, JSONContent } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TextAlign } from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import { useEditor } from '@tiptap/vue-3';
import { storeToRefs } from 'pinia';
import type { MaybeRefOrGetter } from 'vue';
import { toast } from 'vue-sonner';
import { ResizableImage } from '~/components/editor/extensions/ResizableImage';
import { cropImage, optimizeImage, rotateImage } from '~/utils/imageOptimizer';
import { normalizeUploadedImageUrl } from '~/utils/notes';
import { uploadImage } from '~/services/notesService';
import type { Note } from '~/types/notes';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'optimizing' | 'cropping' | 'rotating';

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: 'px';
};

interface UseNoteEditorProps {
  note?: MaybeRefOrGetter<Note | null | undefined>;
  onSave: (note: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) => void;
  isPending: MaybeRefOrGetter<boolean>;
}

function normalizeTagList(input: string[]): string[] {
  return [...new Set(input
    .map((tag) => tag.trim().replace(/\s+/g, ' '))
    .filter(Boolean))];
}

function parseTagDraft(rawInput: string): string[] {
  const trimmedInput = rawInput.trim();
  if (!trimmedInput) return [];

  if (trimmedInput.includes(',')) {
    return normalizeTagList(trimmedInput.split(','));
  }

  if (trimmedInput.includes('#')) {
    return normalizeTagList(trimmedInput.split('#'));
  }

  return normalizeTagList([trimmedInput.replace(/^#+/, '')]);
}

function normalizeContentImageUrls(content: JSONContent): JSONContent {
  const next: JSONContent = {
    ...content,
    attrs: content.attrs
      ? {
          ...content.attrs,
          ...(typeof content.attrs.src === 'string'
            ? { src: normalizeUploadedImageUrl(content.attrs.src) }
            : {}),
        }
      : content.attrs,
  };

  if (content.content) {
    next.content = content.content.map((child) => normalizeContentImageUrls(child));
  }

  return next;
}

function isEditorContentEmpty(content: JSONContent) {
  return !content ||
    (content.content &&
      content.content.length === 1 &&
      (!content.content[0]?.content || content.content[0].content.length === 0));
}

export function useNoteEditor({ note, onSave, isPending }: UseNoteEditorProps) {
  const auth = useAuthStore();
  const { token } = storeToRefs(auth);
  const currentNote = computed(() => toValue(note));
  const pending = computed(() => toValue(isPending));

  const title = ref(currentNote.value?.title || '');
  const tags = ref<string[]>((currentNote.value?.tags ?? []).map((tag) => tag.name));
  const tagInput = ref('');
  const folderId = ref<string | null>(currentNote.value?.folderId ?? null);
  const saveStatus = ref<SaveStatus>('idle');

  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let savedStatusTimer: ReturnType<typeof setTimeout> | null = null;
  let hasPendingChanges = false;
  let lastNoteId: string | null = null;

  const triggerAutoSave = () => {
    if (pending.value) {
      hasPendingChanges = true;
      return;
    }

    hasPendingChanges = false;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    saveStatus.value = 'idle';

    autoSaveTimer = setTimeout(() => {
      const currentEditor = editor.value as Editor | null;
      if (!currentEditor) return;

      const currentContent = currentEditor.getJSON();
      if (isEditorContentEmpty(currentContent)) return;

      saveStatus.value = 'saving';
      onSave({
        title: title.value.trim() || '',
        content: currentContent,
        tags: normalizeTagList(tags.value),
        folderId: folderId.value,
      });
    }, 1000);
  };

  async function handleFileUpload(file: File) {
    const currentEditor = editor.value as Editor | null;
    if (!currentEditor || !token.value) return;

    const isHeic = file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif');

    if (isHeic) {
      toast.error('HEIC images are not supported', {
        description: 'Please upload a JPEG, PNG, or WebP image.',
      });
      return;
    }

    try {
      saveStatus.value = 'optimizing';
      const optimizedFile = await optimizeImage(file);

      saveStatus.value = 'saving';
      const result = await uploadImage(token.value, optimizedFile);
      if (!result.success) throw new Error(result.error);

      const timestampUrl = `${normalizeUploadedImageUrl(result.data.url)}?v=${Date.now()}`;
      currentEditor.chain().focus().setImage({ src: timestampUrl }).run();
      saveStatus.value = 'saved';
    } catch (error) {
      toast.error('Failed to upload image', {
        description: error instanceof Error ? error.message : undefined,
      });
      saveStatus.value = 'idle';
    }
  }

  async function handleCrop(file: File, pixelCrop: PixelCrop) {
    const currentEditor = editor.value as Editor | null;
    if (!currentEditor || !token.value) return;

    try {
      saveStatus.value = 'cropping';
      const croppedFile = await cropImage(file, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);

      saveStatus.value = 'saving';
      const result = await uploadImage(token.value, croppedFile);
      if (!result.success) throw new Error(result.error);

      const timestampUrl = `${normalizeUploadedImageUrl(result.data.url)}?v=${Date.now()}`;
      currentEditor.chain().focus().deleteSelection().setImage({ src: timestampUrl }).run();
      saveStatus.value = 'saved';
    } catch (error) {
      toast.error('Failed to crop image', {
        description: error instanceof Error ? error.message : undefined,
      });
      saveStatus.value = 'idle';
    }
  }

  async function handleRotate(file: File, degrees: number) {
    const currentEditor = editor.value as Editor | null;
    if (!currentEditor || !token.value) return;

    try {
      saveStatus.value = 'rotating';
      const rotatedFile = await rotateImage(file, degrees);

      saveStatus.value = 'saving';
      const result = await uploadImage(token.value, rotatedFile);
      if (!result.success) throw new Error(result.error);

      const timestampUrl = `${normalizeUploadedImageUrl(result.data.url)}?v=${Date.now()}`;
      currentEditor.chain().focus().deleteSelection().setImage({ src: timestampUrl }).run();
      saveStatus.value = 'saved';
    } catch (error) {
      toast.error('Failed to rotate image', {
        description: error instanceof Error ? error.message : undefined,
      });
      saveStatus.value = 'idle';
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      BubbleMenu,
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'notesaides-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
      ResizableImage.configure({ inline: true, allowBase64: true }),
    ],
    content: currentNote.value?.content ? normalizeContentImageUrls(currentNote.value.content) : '',
    onUpdate: () => {
      triggerAutoSave();
    },
    editorProps: {
      handleDrop: (_view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            void handleFileUpload(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (_view, event) => {
        if (event.clipboardData?.files?.[0]) {
          const file = event.clipboardData.files[0];
          if (file.type.startsWith('image/')) {
            void handleFileUpload(file);
            return true;
          }
        }
        return false;
      },
      attributes: {
        class: 'prose prose-lg dark:prose-invert prose-zinc max-w-none focus:outline-none min-h-[500px] prose-p:my-2 prose-headings:font-bold prose-headings:tracking-tight prose-img:rounded-md prose-img:border prose-img:border-border prose-ul:list-disc prose-ol:list-decimal selection:bg-primary/20',
      },
    },
  });

  watch(
    () => currentNote.value?.id ?? null,
    () => {
      const nextNote = currentNote.value;

      if (nextNote?.id !== lastNoteId) {
        lastNoteId = nextNote?.id ?? null;
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
          autoSaveTimer = null;
        }
      }

      if (nextNote === null) {
        editor.value?.commands.clearContent();
        title.value = '';
        tags.value = [];
        tagInput.value = '';
        folderId.value = null;
        return;
      }

      if (nextNote?.content) {
        editor.value?.commands.setContent(normalizeContentImageUrls(nextNote.content));
        title.value = nextNote.title || '';
        tags.value = (nextNote.tags ?? []).map((tag) => tag.name);
        tagInput.value = '';
        folderId.value = nextNote.folderId ?? null;
      }
    },
  );

  watch(
    [pending, saveStatus],
    () => {
      if (!pending.value && saveStatus.value === 'saving') {
        saveStatus.value = 'saved';
      }

      if (!pending.value && hasPendingChanges) {
        hasPendingChanges = false;
        triggerAutoSave();
      }

      if (savedStatusTimer) {
        clearTimeout(savedStatusTimer);
        savedStatusTimer = null;
      }

      if (saveStatus.value === 'saved') {
        savedStatusTimer = setTimeout(() => {
          saveStatus.value = 'idle';
        }, 2500);
      }
    },
  );

  function handleTitleChange(newTitle: string) {
    title.value = newTitle;
    triggerAutoSave();
  }

  function handleTagInputChange(nextValue: string) {
    tagInput.value = nextValue;
  }

  function handleAddTag(rawTagInput = tagInput.value) {
    const parsedTags = parseTagDraft(rawTagInput);
    if (!parsedTags.length) {
      tagInput.value = '';
      return false;
    }

    tags.value = normalizeTagList([...tags.value, ...parsedTags]);
    tagInput.value = '';
    triggerAutoSave();
    return true;
  }

  function handleRemoveTag(tagToRemove: string) {
    const normalizedTagToRemove = tagToRemove.trim().toLowerCase();
    tags.value = tags.value.filter((tag) => tag.trim().toLowerCase() !== normalizedTagToRemove);
    tagInput.value = '';
    triggerAutoSave();
  }

  function handleFolderChange(nextFolderId: string | null) {
    folderId.value = nextFolderId;
    triggerAutoSave();
  }

  onBeforeUnmount(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    if (savedStatusTimer) clearTimeout(savedStatusTimer);
    editor.value?.destroy();
  });

  return {
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
    handleCrop,
    handleRotate,
    setSaveStatus: (status: SaveStatus) => {
      saveStatus.value = status;
    },
  };
}

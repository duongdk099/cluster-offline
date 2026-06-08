<script setup lang="ts">
import { Copy, FileText, Link2, Share, Share2, Type } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-sonner';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';
import type { Note } from '~/types/notes';
import { stripHtml } from '~/utils/notes';

const props = defineProps<{
  note: Note;
}>();

type Visibility = 'private' | 'public';

const open = ref(false);
const publicUrl = ref<string | null>(null);
const canSystemShare = ref(false);
const visibility = ref<Visibility>('private');
const isUpdatingVisibility = ref(false);

const config = useRuntimeConfig();
const apiUrl = String(config.public.apiUrl || 'http://localhost:3001').replace(/\/$/, '');

const auth = useAuthStore();
const { token } = storeToRefs(auth);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

onMounted(() => {
  canSystemShare.value = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
});

// Reset state when switching notes.
watch(() => props.note?.id, () => {
  publicUrl.value = null;
  visibility.value = 'private';
  isUpdatingVisibility.value = false;
});

// Load existing share state when the modal opens.
watch(open, async (isOpen) => {
  if (!isOpen) return;
  if (!token.value || !props.note?.id) return;
  try {
    const res = await fetch(`${apiUrl}/notes/${props.note.id}/share`, {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    if (!res.ok) return;
    const data = await res.json() as { token: string | null };
    if (data.token) {
      visibility.value = 'public';
      publicUrl.value = `${window.location.origin}/share/${data.token}`;
    } else {
      visibility.value = 'private';
      publicUrl.value = null;
    }
  } catch {
    // ignore — keep defaults
  }
});

function noteUrl() {
  return `${window.location.origin}/notes/${props.note.id}`;
}

async function handleCopyLink() {
  try {
    await navigator.clipboard.writeText(noteUrl());
    toast.success('Link copied to clipboard');
  } catch (error) {
    toast.error('Could not copy link', {
      description: getErrorMessage(error, 'Clipboard access failed.'),
    });
  }
}

async function handleCopyAsText() {
  try {
    const text = stripHtml(props.note.content);
    await navigator.clipboard.writeText(text);
    toast.success('Note text copied to clipboard');
  } catch (error) {
    toast.error('Could not copy text', {
      description: getErrorMessage(error, 'Clipboard access failed.'),
    });
  }
}

async function handleSystemShare() {
  try {
    await navigator.share({
      title: props.note.title || 'Untitled',
      url: noteUrl(),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    toast.error('Could not share', {
      description: getErrorMessage(error, 'System share failed.'),
    });
  }
}

async function setVisibility(next: Visibility) {
  if (next === visibility.value || isUpdatingVisibility.value) return;
  if (!props.note?.id || !token.value) return;
  isUpdatingVisibility.value = true;
  try {
    if (next === 'public') {
      const res = await fetch(`${apiUrl}/notes/${props.note.id}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { token: string };
      visibility.value = 'public';
      publicUrl.value = `${window.location.origin}/share/${data.token}`;
      toast.success('Public link created');
    } else {
      const res = await fetch(`${apiUrl}/notes/${props.note.id}/share`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token.value}` },
      });
      if (!res.ok) throw new Error(await res.text());
      visibility.value = 'private';
      publicUrl.value = null;
      toast.success('Sharing disabled');
    }
  } catch (e) {
    toast.error('Failed to update sharing', {
      description: e instanceof Error ? e.message : undefined,
    });
  } finally {
    isUpdatingVisibility.value = false;
  }
}

async function copyPublicUrl() {
  if (!publicUrl.value) return;
  try {
    await navigator.clipboard.writeText(publicUrl.value);
    toast.success('Public link copied to clipboard');
  } catch (error) {
    toast.error('Could not copy link', {
      description: getErrorMessage(error, 'Clipboard access failed.'),
    });
  }
}

function parseFilename(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return fallback;
}

async function exportNote(noteId: string, format: 'md' | 'pdf' | 'docx') {
  try {
    const res = await fetch(`${apiUrl}/notes/${noteId}/export/${format}`, {
      headers: {
        Authorization: `Bearer ${token.value ?? ''}`,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Request failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const fallback = `note-${noteId.slice(0, 8)}.${format}`;
    const filename = parseFilename(res.headers.get('Content-Disposition'), fallback);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success(`Exported as ${format.toUpperCase()}`);
  } catch (error) {
    toast.error(`Could not export as ${format.toUpperCase()}`, {
      description: getErrorMessage(error, 'Export request failed.'),
    });
  }
}
</script>

<template>
  <Button variant="ghost" size="icon" title="Share" @click="open = true">
    <Share class="size-4" />
  </Button>

  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      @click.self="open = false"
      @keydown.esc="open = false"
    >
      <div
        class="w-full max-w-md rounded-lg border bg-popover text-popover-foreground shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div class="border-b px-5 py-4">
          <h2 class="text-base font-semibold">Share note</h2>
          <p class="mt-1 text-xs text-muted-foreground">
            Copy a link, share via your system, or export to a file.
          </p>
        </div>

        <div class="space-y-1 p-3">
          <div class="space-y-1 px-1 py-2">
            <p class="px-2 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              Visibility
            </p>
            <label
              class="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-accent"
              :class="visibility === 'private' ? 'bg-accent' : ''"
            >
              <input
                type="radio"
                name="share-visibility"
                value="private"
                :checked="visibility === 'private'"
                :disabled="isUpdatingVisibility"
                class="mt-0.5"
                @change="setVisibility('private')"
              >
              <span class="flex flex-col">
                <span class="text-sm font-medium">Private</span>
                <span class="text-xs text-muted-foreground">Only you can open this note.</span>
              </span>
            </label>
            <label
              class="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-accent"
              :class="visibility === 'public' ? 'bg-accent' : ''"
            >
              <input
                type="radio"
                name="share-visibility"
                value="public"
                :checked="visibility === 'public'"
                :disabled="isUpdatingVisibility"
                class="mt-0.5"
                @change="setVisibility('public')"
              >
              <span class="flex flex-col">
                <span class="text-sm font-medium">Anyone with the link</span>
                <span class="text-xs text-muted-foreground">Anyone who has the URL can view this note (read-only).</span>
              </span>
            </label>

            <div v-if="visibility === 'public' && publicUrl" class="mt-2 flex items-center gap-2 rounded-md border bg-muted/30 p-2">
              <code class="min-w-0 flex-1 truncate text-xs">{{ publicUrl }}</code>
              <Button size="sm" variant="ghost" @click="copyPublicUrl">
                <Copy class="size-3.5" />
                Copy
              </Button>
            </div>
          </div>

          <div class="my-1 h-px bg-border" />

          <Button
            variant="ghost"
            class="h-9 w-full justify-start gap-2"
            @click="handleCopyLink"
          >
            <Link2 class="size-4" />
            <span>Copy link</span>
          </Button>

          <Button
            variant="ghost"
            class="h-9 w-full justify-start gap-2"
            @click="handleCopyAsText"
          >
            <Type class="size-4" />
            <span>Copy as text</span>
          </Button>

          <Button
            v-if="canSystemShare"
            variant="ghost"
            class="h-9 w-full justify-start gap-2"
            @click="handleSystemShare"
          >
            <Share2 class="size-4" />
            <span>Share via system…</span>
          </Button>

          <div class="my-1 h-px bg-border" />

          <Button
            variant="ghost"
            class="h-9 w-full justify-start gap-2"
            @click="exportNote(props.note.id, 'md')"
          >
            <FileText class="size-4" />
            <span>Export as Markdown</span>
          </Button>

          <Button
            variant="ghost"
            class="h-9 w-full justify-start gap-2"
            @click="exportNote(props.note.id, 'pdf')"
          >
            <FileText class="size-4" />
            <span>Export as PDF</span>
          </Button>

          <Button
            variant="ghost"
            class="h-9 w-full justify-start gap-2"
            @click="exportNote(props.note.id, 'docx')"
          >
            <FileText class="size-4" />
            <span>Export as Word</span>
          </Button>
        </div>

        <div class="flex justify-end border-t px-5 py-3">
          <Button variant="ghost" size="sm" @click="open = false">Close</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

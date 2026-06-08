import type { JSONContent } from '@tiptap/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import type { MaybeRefOrGetter } from 'vue';
import { toast } from 'vue-sonner';
import type { Note } from '~/types/notes';
import * as notesService from '~/services/notesService';

type NoteFilters = {
  tag?: string;
  folder?: string;
};

type NotePayload = {
  title: string;
  content: JSONContent;
  tags?: string[];
  folderId?: string | null;
};

function unwrapResult<T>(result: notesService.ServiceResult<T>): T {
  if (!result.success) throw new Error(result.error);
  return result.data;
}

function useToken() {
  const auth = useAuthStore();
  const { token } = storeToRefs(auth);
  return token;
}

function resolvedFilters(filters?: MaybeRefOrGetter<NoteFilters | undefined>) {
  return toValue(filters);
}

export function useNotes(filters?: MaybeRefOrGetter<NoteFilters | undefined>) {
  const token = useToken();

  return useQuery({
    queryKey: computed(() => {
      const nextFilters = resolvedFilters(filters);
      return ['notes', nextFilters?.tag || '', nextFilters?.folder || ''];
    }),
    queryFn: async () => unwrapResult(await notesService.getNotes(token.value, resolvedFilters(filters))),
    enabled: computed(() => !!token.value),
  });
}

export function useTags() {
  const token = useToken();

  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => unwrapResult(await notesService.getTags(token.value)),
    enabled: computed(() => !!token.value),
  });
}

export function useFolders() {
  const token = useToken();

  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => unwrapResult(await notesService.getFolders(token.value)),
    enabled: computed(() => !!token.value),
  });
}

export function useSearchNotes(
  query: MaybeRefOrGetter<string>,
  filters?: MaybeRefOrGetter<NoteFilters | undefined>,
) {
  const token = useToken();
  const normalizedQuery = computed(() => toValue(query).trim());

  return useQuery({
    queryKey: computed(() => {
      const nextFilters = resolvedFilters(filters);
      return ['notes', 'search', normalizedQuery.value, nextFilters?.tag || '', nextFilters?.folder || ''];
    }),
    queryFn: async () => unwrapResult(await notesService.searchNotes(token.value, normalizedQuery.value, resolvedFilters(filters))),
    enabled: computed(() => !!token.value && normalizedQuery.value.length > 0),
  });
}

export function useDeletedNotes() {
  const token = useToken();

  return useQuery({
    queryKey: ['notes', 'deleted'],
    queryFn: async () => unwrapResult(await notesService.getDeletedNotes(token.value)),
    enabled: computed(() => !!token.value),
  });
}

export function useNote(id: MaybeRefOrGetter<string>) {
  const token = useToken();

  return useQuery({
    queryKey: computed(() => ['note', toValue(id)]),
    queryFn: async () => unwrapResult(await notesService.getNote(token.value, toValue(id))),
    enabled: computed(() => !!token.value && !!toValue(id)),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async (newNote: NotePayload) => unwrapResult(await notesService.createNote(token.value, newNote)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// Create an empty note and navigate straight to /notes/{id}, so the user
// never lands on /notes/new — the new note exists in the DB the moment they
// arrive at the editor. Pass { replace: true } from the /notes/new fallback
// page so that URL never sticks in browser history.
export function useCreateAndOpenBlankNote() {
  const router = useRouter();
  const createMutation = useCreateNote();

  const emptyContent: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };

  async function openBlankNote({ replace = false }: { replace?: boolean } = {}): Promise<void> {
    if (createMutation.isPending.value) return;
    try {
      const note = await createMutation.mutateAsync({ title: '', content: emptyContent });
      const path = `/notes/${note.id}`;
      await (replace ? router.replace(path) : router.push(path));
    } catch (error) {
      toast.error('Failed to create note', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return { openBlankNote, isPending: createMutation.isPending };
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<NotePayload>) =>
      unwrapResult(await notesService.updateNote(token.value, id, updates)),
    onSuccess: (updatedNote: Note) => {
      queryClient.setQueriesData<Note[]>({ queryKey: ['notes'] }, (old) =>
        old ? old.map((note) => (note.id === updatedNote.id ? updatedNote : note)) : old,
      );
      queryClient.setQueryData(['note', updatedNote.id], updatedNote);
      // An update can attach a brand-new tag or change the folder, neither of
      // which is reflected by the per-note cache update above — refresh the
      // sidebar lists so they don't go stale.
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async (id: string) => unwrapResult(await notesService.deleteNote(token.value, id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notes', 'deleted'] });
    },
  });
}

export function useRestoreNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async (id: string) => unwrapResult(await notesService.restoreNote(token.value, id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notes', 'deleted'] });
    },
  });
}

export function usePermanentDeleteNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async (id: string) => unwrapResult(await notesService.permanentDeleteNote(token.value, id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notes', 'deleted'] });
    },
  });
}

export function useAddTagToNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      unwrapResult(await notesService.addTagToNote(token.value, id, name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useRemoveTagFromNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id, tagId }: { id: string; tagId: string }) =>
      unwrapResult(await notesService.removeTagFromNote(token.value, id, tagId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => unwrapResult(await notesService.createFolder(token.value, name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useAssignFolderToNote() {
  const queryClient = useQueryClient();
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) =>
      unwrapResult(await notesService.assignFolderToNote(token.value, id, folderId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

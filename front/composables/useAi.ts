import { useMutation } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import * as aiService from '~/services/aiService';

function unwrapResult<T>(result: aiService.ServiceResult<T>): T {
  if (!result.success) throw new Error(result.error);
  return result.data;
}

function useToken() {
  const auth = useAuthStore();
  const { token } = storeToRefs(auth);
  return token;
}

export function useSummarizeNote() {
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) =>
      unwrapResult(await aiService.summarizeNote(token.value, id)),
  });
}

export function useSuggestTagsForNote() {
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) =>
      unwrapResult(await aiService.suggestTagsForNote(token.value, id)),
  });
}

export function useDetectActionsInNote() {
  const token = useToken();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) =>
      unwrapResult(await aiService.detectActionsInNote(token.value, id)),
  });
}

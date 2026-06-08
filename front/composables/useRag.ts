import { useMutation } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import * as ragService from '~/services/ragService';

function unwrapResult<T>(result: ragService.ServiceResult<T>): T {
  if (!result.success) throw new Error(result.error);
  return result.data;
}

function useToken() {
  const auth = useAuthStore();
  const { token } = storeToRefs(auth);
  return token;
}

export function useRagAsk() {
  const token = useToken();
  return useMutation({
    mutationFn: async ({ query }: { query: string }) =>
      unwrapResult(await ragService.askRag(token.value, query)),
  });
}

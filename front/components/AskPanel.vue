<script setup lang="ts">
import { Loader2, Sparkles } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

const query = ref('');
const answer = ref<string | null>(null);
const citations = ref<Array<{ noteId: string; chunkText: string; similarity: number }>>([]);

const askMutation = useRagAsk();

const isPending = computed(() => askMutation.isPending.value);
const trimmedQuery = computed(() => query.value.trim());
const canSubmit = computed(() => trimmedQuery.value.length > 0 && !isPending.value);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function truncate(text: string, max = 200) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

function formatSimilarity(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

async function handleAsk() {
  if (!canSubmit.value) return;
  const q = trimmedQuery.value;
  try {
    const result = await askMutation.mutateAsync({ query: q });
    answer.value = result.answer ?? '';
    citations.value = Array.isArray(result.citations) ? [...result.citations] : [];
  } catch (error) {
    toast.error('Ask failed', {
      description: getErrorMessage(error, 'Could not ask your notes.'),
    });
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleAsk();
  }
}
</script>

<template>
  <div class="space-y-6">
    <form class="space-y-3" @submit.prevent="handleAsk">
      <label for="ask-input" class="sr-only">Ask a question</label>
      <div class="relative">
        <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
          <Sparkles class="size-4" />
        </span>
        <input
          id="ask-input"
          v-model="query"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="Ask a question about your notes..."
          class="h-12 w-full rounded-md border bg-background pl-10 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          :disabled="isPending"
          @keydown="onKeydown"
        >
      </div>
      <div class="flex items-center justify-end">
        <Button type="submit" :disabled="!canSubmit">
          <Loader2 v-if="isPending" class="size-4 animate-spin" />
          <Sparkles v-else class="size-4" />
          {{ isPending ? 'Asking' : 'Ask' }}
        </Button>
      </div>
    </form>

    <section v-if="answer !== null" class="space-y-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="flex items-center gap-2 text-base">
            <Sparkles class="size-4 text-primary" />
            Answer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed dark:prose-invert">
            {{ answer || 'No answer returned.' }}
          </div>
        </CardContent>
      </Card>

      <div v-if="citations.length" class="space-y-2">
        <h2 class="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Citations
        </h2>
        <div class="grid gap-2">
          <Card v-for="(citation, index) in citations" :key="`${citation.noteId}-${index}`" class="bg-card/60">
            <CardContent class="space-y-2 p-3">
              <div class="flex items-center justify-between gap-2">
                <Badge variant="secondary" class="font-mono text-[10px]">
                  {{ formatSimilarity(citation.similarity) }}
                </Badge>
                <NuxtLink
                  :to="`/notes/${citation.noteId}`"
                  class="text-xs font-medium text-primary hover:underline"
                >
                  Open note &rarr;
                </NuxtLink>
              </div>
              <p class="text-sm leading-relaxed text-muted-foreground">
                {{ truncate(citation.chunkText, 200) }}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <p v-else class="text-xs text-muted-foreground">
        No citations returned for this answer.
      </p>
    </section>
  </div>
</template>

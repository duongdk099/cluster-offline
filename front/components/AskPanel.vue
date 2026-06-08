<script setup lang="ts">
import { Bell, CalendarDays, Download, Loader2, Mail, Sparkles } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { DetectedAction } from '~/services/aiService';

type Intent = 'question' | 'action' | 'mixed';

const query = ref('');
const answer = ref<string | null>(null);
const citations = ref<Array<{ noteId: string; chunkText: string; similarity: number }>>([]);
const intent = ref<Intent | null>(null);
const suggestedActions = ref<DetectedAction[]>([]);

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

function capitalize(value: string) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function intentVariant(value: Intent | null) {
  if (value === 'question') return 'secondary' as const;
  return 'default' as const;
}

async function handleAsk() {
  if (!canSubmit.value) return;
  const q = trimmedQuery.value;
  try {
    const result = await askMutation.mutateAsync({ query: q });
    answer.value = result.answer ?? '';
    citations.value = Array.isArray(result.citations) ? [...result.citations] : [];
    intent.value = (result.intent as Intent) ?? null;
    suggestedActions.value = Array.isArray(result.suggestedActions)
      ? [...result.suggestedActions]
      : [];
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

function isCalendarAction(action: DetectedAction): action is Extract<DetectedAction, { type: 'calendar' }> {
  return action.type === 'calendar';
}

function isEmailAction(action: DetectedAction): action is Extract<DetectedAction, { type: 'email' }> {
  return action.type === 'email';
}

function isNotificationAction(action: DetectedAction): action is Extract<DetectedAction, { type: 'notification' }> {
  return action.type === 'notification';
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function formatIcsDate(input?: string) {
  if (!input) {
    const now = new Date();
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    const digits = input.replace(/[^0-9]/g, '').slice(0, 8);
    if (digits.length === 8) return digits;
    const now = new Date();
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  }
  return `${parsed.getUTCFullYear()}${pad(parsed.getUTCMonth() + 1)}${pad(parsed.getUTCDate())}T${pad(parsed.getUTCHours())}${pad(parsed.getUTCMinutes())}${pad(parsed.getUTCSeconds())}Z`;
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildIcs(events: Array<{ title: string; date?: string; notes?: string }>) {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NotesAides//AskPanel//EN',
    'CALSCALE:GREGORIAN',
  ];
  const stamp = formatIcsDate();
  events.forEach((event, idx) => {
    const start = formatIcsDate(event.date);
    const uid = `${Date.now()}-${idx}@notesaides`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (start.includes('T')) {
      lines.push(`DTSTART:${start}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
    }
    lines.push(`SUMMARY:${escapeIcs(event.title || 'Untitled event')}`);
    if (event.notes) lines.push(`DESCRIPTION:${escapeIcs(event.notes)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadIcs(events: Array<{ title: string; date?: string; notes?: string }>) {
  try {
    const ics = buildIcs(events);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'notes-events.ics';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    toast.error('Could not build calendar file', {
      description: getErrorMessage(error, 'ICS generation failed.'),
    });
  }
}

function composeEmail(to?: string, subject?: string, body?: string) {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const querystring = params.length ? `?${params.join('&')}` : '';
  window.location.href = `mailto:${to ?? ''}${querystring}`;
}

async function showNotification(message: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    toast.message(message);
    return;
  }
  try {
    let permission = Notification.permission;
    if (permission !== 'granted' && permission !== 'denied') {
      permission = await Notification.requestPermission();
    }
    if (permission === 'granted') {
      // eslint-disable-next-line no-new
      new Notification(message);
    } else {
      toast.message(message, { description: 'Browser notifications are disabled.' });
    }
  } catch (error) {
    toast.message(message, {
      description: getErrorMessage(error, 'Could not show a system notification.'),
    });
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
      <div v-if="intent" class="flex items-center gap-2">
        <Badge :variant="intentVariant(intent)" class="text-xs">
          {{ capitalize(intent) }}
        </Badge>
      </div>

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

      <div v-if="suggestedActions.length" class="space-y-2">
        <h2 class="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Suggested actions
        </h2>
        <div class="space-y-2">
          <Card v-for="(action, index) in suggestedActions" :key="`action-${index}`" class="bg-card/60">
            <CardHeader class="p-3 pb-1">
              <CardTitle class="flex items-center gap-1.5 text-sm font-semibold">
                <CalendarDays v-if="isCalendarAction(action)" class="size-3.5" />
                <Mail v-else-if="isEmailAction(action)" class="size-3.5" />
                <Bell v-else class="size-3.5" />
                <span class="capitalize">{{ action.type }}</span>
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-2 p-3 pt-1 text-sm">
              <template v-if="isCalendarAction(action)">
                <ul class="space-y-1">
                  <li
                    v-for="(event, eIdx) in action.events"
                    :key="eIdx"
                    class="rounded-sm bg-muted/40 px-2 py-1"
                  >
                    <div class="font-medium">
                      {{ event.title || 'Untitled event' }}
                    </div>
                    <div v-if="event.date" class="text-xs text-muted-foreground">
                      {{ event.date }}
                    </div>
                    <div v-if="event.notes" class="mt-0.5 text-xs text-muted-foreground">
                      {{ event.notes }}
                    </div>
                  </li>
                </ul>
                <Button
                  v-if="action.events.length"
                  size="sm"
                  class="w-full"
                  @click="downloadIcs(action.events)"
                >
                  <Download class="size-3.5" />
                  Download .ics
                </Button>
              </template>

              <template v-else-if="isEmailAction(action)">
                <div v-if="action.to" class="text-xs">
                  <span class="text-muted-foreground">To:</span> {{ action.to }}
                </div>
                <div v-if="action.subject" class="text-xs">
                  <span class="text-muted-foreground">Subject:</span> {{ action.subject }}
                </div>
                <div v-if="action.body" class="whitespace-pre-wrap text-xs text-muted-foreground">
                  {{ action.body }}
                </div>
                <Button
                  size="sm"
                  class="w-full"
                  @click="composeEmail(action.to, action.subject, action.body)"
                >
                  <Mail class="size-3.5" />
                  Compose email
                </Button>
              </template>

              <template v-else-if="isNotificationAction(action)">
                <div class="text-sm">
                  {{ action.message }}
                </div>
                <div v-if="action.when" class="text-xs text-muted-foreground">
                  {{ action.when }}
                </div>
                <Button
                  size="sm"
                  class="w-full"
                  @click="showNotification(action.message)"
                >
                  <Bell class="size-3.5" />
                  Show notification
                </Button>
              </template>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  </div>
</template>

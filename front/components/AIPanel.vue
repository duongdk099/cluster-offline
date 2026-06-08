<script setup lang="ts">
import { Bell, CalendarDays, Download, Loader2, Mail, Sparkles, Tags as TagsIcon, Wand2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { DetectedAction } from '~/services/aiService';

const props = defineProps<{
  noteId: string;
}>();

const emit = defineEmits<{
  'add-tag': [name: string];
}>();

const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});

const summary = ref<string | null>(null);
const suggestedTags = ref<string[]>([]);
const detectedActions = ref<DetectedAction[]>([]);

const summarizeMutation = useSummarizeNote();
const suggestTagsMutation = useSuggestTagsForNote();
const detectActionsMutation = useDetectActionsInNote();

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function recomputePosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const panelWidth = 384; // w-96
  const viewportRight = window.innerWidth - 8;
  // Align right edge of panel with right edge of trigger by default.
  let left = rect.right - panelWidth;
  if (left + panelWidth > viewportRight) left = viewportRight - panelWidth;
  if (left < 8) left = 8;
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${panelWidth}px`,
    zIndex: '60',
  };
}

function togglePanel() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(recomputePosition);
  }
}

function closePanel() {
  isOpen.value = false;
}

function onDocumentClick(event: MouseEvent) {
  if (!isOpen.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (triggerRef.value && triggerRef.value.contains(target)) return;
  const panelEl = document.getElementById('ai-panel-popover');
  if (panelEl && panelEl.contains(target)) return;
  closePanel();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) closePanel();
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', recomputePosition);
  window.addEventListener('scroll', recomputePosition, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', recomputePosition);
  window.removeEventListener('scroll', recomputePosition, true);
});

// Reset state when switching to a different note.
watch(() => props.noteId, () => {
  summary.value = null;
  suggestedTags.value = [];
  detectedActions.value = [];
});

async function handleSummarize() {
  try {
    const result = await summarizeMutation.mutateAsync({ id: props.noteId });
    summary.value = result.summary;
  } catch (error) {
    toast.error('Failed to summarize note', {
      description: getErrorMessage(error, 'The AI summarize request failed.'),
    });
  }
}

async function handleSuggestTags() {
  try {
    const result = await suggestTagsMutation.mutateAsync({ id: props.noteId });
    suggestedTags.value = Array.isArray(result.tags) ? [...result.tags] : [];
  } catch (error) {
    toast.error('Failed to suggest tags', {
      description: getErrorMessage(error, 'The AI auto-tag request failed.'),
    });
  }
}

async function handleDetectActions() {
  try {
    const result = await detectActionsMutation.mutateAsync({ id: props.noteId });
    detectedActions.value = Array.isArray(result.actions) ? [...result.actions] : [];
  } catch (error) {
    toast.error('Failed to detect actions', {
      description: getErrorMessage(error, 'The AI extract-actions request failed.'),
    });
  }
}

function pickTag(name: string) {
  emit('add-tag', name);
  suggestedTags.value = suggestedTags.value.filter((t) => t !== name);
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
    // Treat as date-only string (YYYY-MM-DD) — strip non-digits, take first 8 chars.
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
    'PRODID:-//NotesAides//AIPanel//EN',
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
  const query = params.length ? `?${params.join('&')}` : '';
  window.location.href = `mailto:${to ?? ''}${query}`;
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

function isCalendarAction(action: DetectedAction): action is Extract<DetectedAction, { type: 'calendar' }> {
  return action.type === 'calendar';
}

function isEmailAction(action: DetectedAction): action is Extract<DetectedAction, { type: 'email' }> {
  return action.type === 'email';
}

function isNotificationAction(action: DetectedAction): action is Extract<DetectedAction, { type: 'notification' }> {
  return action.type === 'notification';
}
</script>

<template>
  <div class="relative inline-flex">
    <Button
      ref="triggerRef"
      variant="ghost"
      size="icon"
      title="AI assist"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click="togglePanel"
    >
      <Sparkles class="size-4" />
    </Button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        id="ai-panel-popover"
        :style="panelStyle"
        class="max-h-[80vh] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg"
        role="dialog"
        aria-label="AI assist"
      >
        <div class="space-y-4 p-4">
          <div class="flex items-center gap-2">
            <Sparkles class="size-4 text-primary" />
            <span class="text-sm font-semibold">AI assist</span>
          </div>

          <!-- Summarize -->
          <section class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium">
                Summarize
              </h3>
              <Button
                variant="outline"
                size="sm"
                :disabled="summarizeMutation.isPending.value"
                @click="handleSummarize"
              >
                <Loader2 v-if="summarizeMutation.isPending.value" class="size-3.5 animate-spin" />
                <Wand2 v-else class="size-3.5" />
                {{ summarizeMutation.isPending.value ? 'Summarizing' : 'Summarize' }}
              </Button>
            </div>
            <Card v-if="summary" class="bg-card/60">
              <CardContent class="p-3">
                <div class="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed">
                  {{ summary }}
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- Suggest tags -->
          <section class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="flex items-center gap-1.5 text-sm font-medium">
                <TagsIcon class="size-3.5" />
                Suggest tags
              </h3>
              <Button
                variant="outline"
                size="sm"
                :disabled="suggestTagsMutation.isPending.value"
                @click="handleSuggestTags"
              >
                <Loader2 v-if="suggestTagsMutation.isPending.value" class="size-3.5 animate-spin" />
                <Wand2 v-else class="size-3.5" />
                {{ suggestTagsMutation.isPending.value ? 'Thinking' : 'Suggest' }}
              </Button>
            </div>
            <div v-if="suggestedTags.length" class="flex flex-wrap gap-1.5">
              <button
                v-for="tag in suggestedTags"
                :key="tag"
                type="button"
                class="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                :title="`Add #${tag}`"
                @click="pickTag(tag)"
              >
                <Badge variant="secondary" class="gap-1 hover:bg-secondary/80 transition-colors">
                  #{{ tag }}
                </Badge>
              </button>
            </div>
            <p
              v-else-if="!suggestTagsMutation.isPending.value && suggestTagsMutation.isSuccess.value"
              class="text-xs text-muted-foreground"
            >
              No tag suggestions found.
            </p>
          </section>

          <!-- Detect actions -->
          <section class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium">
                Detect actions
              </h3>
              <Button
                variant="outline"
                size="sm"
                :disabled="detectActionsMutation.isPending.value"
                @click="handleDetectActions"
              >
                <Loader2 v-if="detectActionsMutation.isPending.value" class="size-3.5 animate-spin" />
                <Wand2 v-else class="size-3.5" />
                {{ detectActionsMutation.isPending.value ? 'Scanning' : 'Detect' }}
              </Button>
            </div>

            <div v-if="detectedActions.length" class="space-y-2">
              <Card v-for="(action, index) in detectedActions" :key="index" class="bg-card/60">
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
            <p
              v-else-if="!detectActionsMutation.isPending.value && detectActionsMutation.isSuccess.value"
              class="text-xs text-muted-foreground"
            >
              No actions detected.
            </p>
          </section>
        </div>
      </div>
    </Teleport>
  </div>
</template>

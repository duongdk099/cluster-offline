import { INoteRepository } from '../domain/Note';
import { extractNoteText } from './extractNoteText';
import { deepseekChat } from '../infrastructure/DeepSeekClient';
import { config } from '../config';

const MAX_CALENDAR_EVENTS = 10;

export type DetectedAction =
    | { type: 'calendar'; events: Array<{ title: string; date?: string; notes?: string }> }
    | { type: 'email'; to?: string; subject?: string; body?: string }
    | { type: 'notification'; message: string; when?: string };

function isStringOrUndefined(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}

function validateAction(raw: unknown): DetectedAction | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const obj = raw as Record<string, unknown>;
    const type = obj.type;

    if (type === 'calendar') {
        const events = obj.events;
        if (!Array.isArray(events)) {
            return null;
        }
        const validEvents: Array<{ title: string; date?: string; notes?: string }> = [];
        for (const event of events) {
            if (!event || typeof event !== 'object') {
                continue;
            }
            const e = event as Record<string, unknown>;
            if (typeof e.title !== 'string' || e.title.trim().length === 0) {
                continue;
            }
            if (!isStringOrUndefined(e.date) || !isStringOrUndefined(e.notes)) {
                continue;
            }
            const entry: { title: string; date?: string; notes?: string } = { title: e.title };
            if (typeof e.date === 'string') entry.date = e.date;
            if (typeof e.notes === 'string') entry.notes = e.notes;
            validEvents.push(entry);
            if (validEvents.length >= MAX_CALENDAR_EVENTS) break;
        }
        if (validEvents.length === 0) {
            return null;
        }
        return { type: 'calendar', events: validEvents };
    }

    if (type === 'email') {
        if (!isStringOrUndefined(obj.to) || !isStringOrUndefined(obj.subject) || !isStringOrUndefined(obj.body)) {
            return null;
        }
        const action: { type: 'email'; to?: string; subject?: string; body?: string } = { type: 'email' };
        if (typeof obj.to === 'string') action.to = obj.to;
        if (typeof obj.subject === 'string') action.subject = obj.subject;
        if (typeof obj.body === 'string') action.body = obj.body;
        return action;
    }

    if (type === 'notification') {
        if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
            return null;
        }
        if (!isStringOrUndefined(obj.when)) {
            return null;
        }
        const action: { type: 'notification'; message: string; when?: string } = {
            type: 'notification',
            message: obj.message,
        };
        if (typeof obj.when === 'string') action.when = obj.when;
        return action;
    }

    return null;
}

export async function detectActionsInText(text: string): Promise<DetectedAction[]> {
    const maxInputChars = config.rag.detectActionsMaxInputChars;
    const trimmed = text.length > maxInputChars
        ? text.slice(0, maxInputChars)
        : text;

    const systemPrompt = [
        'You analyze personal notes and extract actionable items.',
        'Return STRICT JSON in the exact form: {"actions": [...]}.',
        'Each action has a "type" field which is one of: "calendar", "email", "notification".',
        'Calendar action shape: {"type":"calendar","events":[{"title":string,"date"?:string,"notes"?:string}, ...]} — use this when the note contains todo lists, scheduled items, meetings, or deadlines. Include up to 10 events. The "date" field should be ISO-like (YYYY-MM-DD or YYYY-MM-DDTHH:mm) when known; omit it otherwise.',
        'Email action shape: {"type":"email","to"?:string,"subject"?:string,"body"?:string} — use this when the note says things like "email so-and-so about X" or contains a drafted message.',
        'Notification action shape: {"type":"notification","message":string,"when"?:string} — use this when the note mentions reminders, "don\'t forget to", or things to be reminded about.',
        'Return an empty array if nothing is actionable.',
        'Do NOT invent actions that are not clearly supported by the note text.',
        'Output JSON only, no prose.',
    ].join(' ');

    let raw: string;
    try {
        raw = await deepseekChat({
            jsonMode: true,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: trimmed,
                },
            ],
        });
    } catch {
        return [];
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }

    if (!parsed || typeof parsed !== 'object') {
        return [];
    }

    const actionsField = (parsed as { actions?: unknown }).actions;
    if (!Array.isArray(actionsField)) {
        return [];
    }

    const validated: DetectedAction[] = [];
    for (const item of actionsField) {
        const action = validateAction(item);
        if (action) {
            validated.push(action);
        }
    }

    return validated;
}

export class DetectActionsInNoteUseCase {
    constructor(private noteRepository: INoteRepository) {}

    async execute(noteId: string, userId: string): Promise<{ actions: DetectedAction[] } | null> {
        const note = await this.noteRepository.findById(noteId, userId);
        if (!note) {
            return null;
        }
        const text = extractNoteText(note.content);
        if (!text.trim()) {
            return { actions: [] };
        }
        return { actions: await detectActionsInText(text) };
    }
}

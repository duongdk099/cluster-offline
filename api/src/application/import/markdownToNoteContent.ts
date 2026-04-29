import { JsonObject, JsonValue } from '../../domain/Note';

type TipTapMark = {
    type: string;
    attrs?: JsonObject;
};

type TipTapNode = {
    type: string;
    attrs?: JsonObject;
    text?: string;
    marks?: TipTapMark[];
    content?: TipTapNode[];
};

function parseInline(text: string): TipTapNode[] {
    const nodes: TipTapNode[] = [];
    const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > cursor) {
            nodes.push({ type: 'text', text: text.slice(cursor, match.index) });
        }

        const token = match[0];
        if (token.startsWith('**') || token.startsWith('__')) {
            nodes.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] });
        } else if (token.startsWith('*') || token.startsWith('_')) {
            nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] });
        } else if (token.startsWith('`')) {
            nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'code' }] });
        } else {
            const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
            if (linkMatch) {
                nodes.push({
                    type: 'text',
                    text: linkMatch[1],
                    marks: [{ type: 'link', attrs: { href: linkMatch[2] } }],
                });
            }
        }

        cursor = match.index + token.length;
    }

    if (cursor < text.length) {
        nodes.push({ type: 'text', text: text.slice(cursor) });
    }

    return nodes.length > 0 ? nodes : [];
}

function paragraphNode(lines: string[]): TipTapNode | null {
    const text = lines.join('\n').trim();
    if (!text) return null;

    return {
        type: 'paragraph',
        content: lines.flatMap((line, index) => {
            const nodes: TipTapNode[] = [];
            if (index > 0) {
                nodes.push({ type: 'hardBreak' });
            }
            nodes.push(...parseInline(line));
            return nodes;
        }),
    };
}

function listItemNode(text: string, checked?: boolean): TipTapNode {
    const item: TipTapNode = {
        type: checked === undefined ? 'listItem' : 'taskItem',
        content: [
            {
                type: 'paragraph',
                content: parseInline(text.trim()),
            },
        ],
    };

    if (checked !== undefined) {
        item.attrs = { checked };
    }

    return item;
}

function flushParagraph(content: TipTapNode[], paragraphLines: string[]): string[] {
    const paragraph = paragraphNode(paragraphLines);
    if (paragraph) {
        content.push(paragraph);
    }
    return [];
}

export function markdownToNoteContent(markdown: string): JsonValue {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const content: TipTapNode[] = [];
    let paragraphLines: string[] = [];
    let codeFenceLanguage = '';
    let codeFenceLines: string[] | null = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+$/g, '');

        if (codeFenceLines) {
            if (line.startsWith('```')) {
                content.push({
                    type: 'codeBlock',
                    attrs: codeFenceLanguage ? { language: codeFenceLanguage } : {},
                    content: [{ type: 'text', text: codeFenceLines.join('\n') }],
                });
                codeFenceLines = null;
                codeFenceLanguage = '';
            } else {
                codeFenceLines.push(rawLine);
            }
            continue;
        }

        if (line.startsWith('```')) {
            paragraphLines = flushParagraph(content, paragraphLines);
            codeFenceLanguage = line.slice(3).trim();
            codeFenceLines = [];
            continue;
        }

        if (!line.trim()) {
            paragraphLines = flushParagraph(content, paragraphLines);
            continue;
        }

        const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
        if (headingMatch) {
            paragraphLines = flushParagraph(content, paragraphLines);
            content.push({
                type: 'heading',
                attrs: { level: Math.min(headingMatch[1].length, 3) },
                content: parseInline(headingMatch[2]),
            });
            continue;
        }

        const blockquoteMatch = /^>\s?(.+)$/.exec(line);
        if (blockquoteMatch) {
            paragraphLines = flushParagraph(content, paragraphLines);
            content.push({
                type: 'blockquote',
                content: [{ type: 'paragraph', content: parseInline(blockquoteMatch[1]) }],
            });
            continue;
        }

        const taskMatch = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line);
        if (taskMatch) {
            paragraphLines = flushParagraph(content, paragraphLines);
            content.push({
                type: 'taskList',
                content: [listItemNode(taskMatch[2], taskMatch[1].toLowerCase() === 'x')],
            });
            continue;
        }

        const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
        if (bulletMatch) {
            paragraphLines = flushParagraph(content, paragraphLines);
            content.push({
                type: 'bulletList',
                content: [listItemNode(bulletMatch[1])],
            });
            continue;
        }

        const orderedMatch = /^\d+\.\s+(.+)$/.exec(line);
        if (orderedMatch) {
            paragraphLines = flushParagraph(content, paragraphLines);
            content.push({
                type: 'orderedList',
                attrs: { start: 1 },
                content: [listItemNode(orderedMatch[1])],
            });
            continue;
        }

        paragraphLines.push(line);
    }

    if (codeFenceLines) {
        content.push({
            type: 'codeBlock',
            attrs: codeFenceLanguage ? { language: codeFenceLanguage } : {},
            content: [{ type: 'text', text: codeFenceLines.join('\n') }],
        });
    }

    flushParagraph(content, paragraphLines);

    return {
        type: 'doc',
        content: content.length > 0 ? content : [{ type: 'paragraph' }],
    };
}

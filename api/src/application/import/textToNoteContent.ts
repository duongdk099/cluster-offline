import { JsonObject, JsonValue } from '../../domain/Note';

type TipTapNode = {
    type: string;
    attrs?: JsonObject;
    text?: string;
    marks?: Array<{ type: string; attrs?: JsonObject }>;
    content?: TipTapNode[];
};

export function textToNoteContent(text: string): JsonValue {
    const paragraphs = text
        .replace(/\r\n/g, '\n')
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map<TipTapNode>((paragraph) => ({
            type: 'paragraph',
            content: paragraph.split('\n').flatMap((line, index) => {
                const nodes: TipTapNode[] = [];
                if (index > 0) {
                    nodes.push({ type: 'hardBreak' });
                }
                nodes.push({ type: 'text', text: line });
                return nodes;
            }),
        }));

    return {
        type: 'doc',
        content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }],
    };
}

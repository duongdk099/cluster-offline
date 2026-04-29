export type RichTextMark = {
    type?: string;
    attrs?: Record<string, unknown>;
};

export type RichTextNode = {
    type?: string;
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: RichTextMark[];
    content?: RichTextNode[];
};

export function asRichTextNode(content: unknown): RichTextNode {
    if (content && typeof content === 'object' && !Array.isArray(content)) {
        return content as RichTextNode;
    }

    return { type: 'doc', content: [] };
}


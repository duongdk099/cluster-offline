type RichTextNode = {
    type?: string;
    text?: string;
    content?: RichTextNode[];
};

const BLOCK_NODE_TYPES = new Set([
    'doc',
    'paragraph',
    'heading',
    'blockquote',
    'bulletList',
    'orderedList',
    'taskList',
    'taskItem',
    'listItem',
    'table',
    'tableRow',
    'tableCell',
    'tableHeader',
    'codeBlock',
]);

function collectNodeText(node: unknown): string {
    if (node === null || node === undefined) {
        return '';
    }

    if (typeof node === 'string') {
        return node;
    }

    if (Array.isArray(node)) {
        return node.map((child) => collectNodeText(child)).join('\n\n');
    }

    if (typeof node !== 'object') {
        return '';
    }

    const richTextNode = node as RichTextNode;
    if (richTextNode.type === 'text') {
        return typeof richTextNode.text === 'string' ? richTextNode.text : '';
    }

    if (richTextNode.type === 'hardBreak') {
        return '\n';
    }

    const childText = Array.isArray(richTextNode.content)
        ? richTextNode.content.map((child) => collectNodeText(child)).join('')
        : '';

    if (BLOCK_NODE_TYPES.has(richTextNode.type ?? '')) {
        return childText ? `${childText}\n\n` : '';
    }

    return childText;
}

export function extractNoteText(content: unknown): string {
    return collectNodeText(content)
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

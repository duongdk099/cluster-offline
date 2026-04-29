import { RichTextMark, RichTextNode, asRichTextNode } from './noteExportTypes';

function escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}

function escapeTableCell(text: string): string {
    return text.replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
}

function getAttrString(node: RichTextNode, key: string): string | undefined {
    const value = node.attrs?.[key];
    return typeof value === 'string' ? value : undefined;
}

function getAttrNumber(node: RichTextNode, key: string): number | undefined {
    const value = node.attrs?.[key];
    return typeof value === 'number' ? value : undefined;
}

function applyMarks(text: string, marks?: RichTextMark[]): string {
    if (!marks?.length) {
        return escapeMarkdown(text);
    }

    return marks.reduce((current, mark) => {
        if (mark.type === 'code') return `\`${current.replace(/`/g, '\\`')}\``;
        if (mark.type === 'bold') return `**${current}**`;
        if (mark.type === 'italic') return `_${current}_`;
        if (mark.type === 'strike') return `~~${current}~~`;
        if (mark.type === 'link') {
            const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
            return href ? `[${current}](${href})` : current;
        }
        return current;
    }, escapeMarkdown(text));
}

function renderInlineChildren(node: RichTextNode): string {
    return (node.content ?? []).map((child) => renderInline(child)).join('');
}

function renderInline(node: RichTextNode): string {
    if (node.type === 'text') return applyMarks(node.text ?? '', node.marks);
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'image') {
        const src = getAttrString(node, 'src') ?? '';
        const alt = getAttrString(node, 'alt') ?? 'image';
        return src ? `![${escapeMarkdown(alt)}](${src})` : '';
    }
    return renderInlineChildren(node);
}

function renderListItem(node: RichTextNode, marker: string, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    const blocks = node.content ?? [];
    const firstBlock = blocks[0];
    const firstLine = firstBlock ? renderInlineChildren(firstBlock).trim() : '';
    const nested = blocks
        .slice(1)
        .map((child) => renderBlock(child, indentLevel + 1))
        .filter(Boolean)
        .join('\n');

    return nested ? `${indent}${marker} ${firstLine}\n${nested}` : `${indent}${marker} ${firstLine}`;
}

function renderTableRow(node: RichTextNode): string[] {
    return (node.content ?? []).map((cell) => escapeTableCell(renderInlineChildren(cell).trim()));
}

function renderTable(node: RichTextNode): string {
    const rows = (node.content ?? []).map(renderTableRow).filter((row) => row.length > 0);
    if (rows.length === 0) return '';

    const width = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => [...row, ...Array(width - row.length).fill('')]);
    const header = normalizedRows[0];
    const separator = Array(width).fill('---');
    const body = normalizedRows.slice(1);

    return [
        `| ${header.join(' | ')} |`,
        `| ${separator.join(' | ')} |`,
        ...body.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
}

function renderBlock(node: RichTextNode, indentLevel = 0): string {
    switch (node.type) {
        case 'doc':
            return (node.content ?? []).map((child) => renderBlock(child, indentLevel)).filter(Boolean).join('\n\n');
        case 'paragraph':
            return renderInlineChildren(node).trim();
        case 'heading': {
            const level = Math.min(Math.max(getAttrNumber(node, 'level') ?? 1, 1), 6);
            return `${'#'.repeat(level)} ${renderInlineChildren(node).trim()}`;
        }
        case 'blockquote':
            return renderInlineChildren(node)
                .split('\n')
                .map((line) => `> ${line}`)
                .join('\n');
        case 'codeBlock': {
            const language = getAttrString(node, 'language') ?? '';
            return `\`\`\`${language}\n${renderInlineChildren(node)}\n\`\`\``;
        }
        case 'bulletList':
            return (node.content ?? []).map((child) => renderListItem(child, '-', indentLevel)).join('\n');
        case 'orderedList': {
            const start = getAttrNumber(node, 'start') ?? 1;
            return (node.content ?? [])
                .map((child, index) => renderListItem(child, `${start + index}.`, indentLevel))
                .join('\n');
        }
        case 'taskList':
            return (node.content ?? []).map((child) => {
                const checked = child.attrs?.checked === true ? 'x' : ' ';
                return renderListItem(child, `- [${checked}]`, indentLevel);
            }).join('\n');
        case 'table':
            return renderTable(node);
        case 'horizontalRule':
            return '---';
        case 'image':
            return renderInline(node);
        default:
            return renderInlineChildren(node).trim();
    }
}

export function noteContentToMarkdown(content: unknown): string {
    return renderBlock(asRichTextNode(content))
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}


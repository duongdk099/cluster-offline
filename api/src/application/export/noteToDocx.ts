import {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { Note } from '../../domain/Note';
import { RichTextMark, RichTextNode, asRichTextNode } from './noteExportTypes';

type DocxChild = Paragraph | Table;

function getAttrString(node: RichTextNode, key: string): string | undefined {
    const value = node.attrs?.[key];
    return typeof value === 'string' ? value : undefined;
}

function getAttrNumber(node: RichTextNode, key: string): number | undefined {
    const value = node.attrs?.[key];
    return typeof value === 'number' ? value : undefined;
}

function marksToStyle(marks?: RichTextMark[]) {
    return {
        bold: marks?.some((mark) => mark.type === 'bold') ?? false,
        italics: marks?.some((mark) => mark.type === 'italic') ?? false,
        strike: marks?.some((mark) => mark.type === 'strike') ?? false,
    };
}

function textRunsFromInline(node: RichTextNode): TextRun[] {
    if (node.type === 'text') {
        return [new TextRun({ text: node.text ?? '', ...marksToStyle(node.marks) })];
    }

    if (node.type === 'hardBreak') {
        return [new TextRun({ break: 1 })];
    }

    if (node.type === 'image') {
        const src = getAttrString(node, 'src');
        return [new TextRun({ text: src ? `[Image: ${src}]` : '[Image]' })];
    }

    return (node.content ?? []).flatMap((child) => textRunsFromInline(child));
}

function paragraphText(node: RichTextNode): string {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    return (node.content ?? []).map(paragraphText).join('');
}

function alignmentFromNode(node: RichTextNode): typeof AlignmentType.LEFT | typeof AlignmentType.CENTER | typeof AlignmentType.RIGHT | undefined {
    const textAlign = getAttrString(node, 'textAlign');
    if (textAlign === 'center') return AlignmentType.CENTER;
    if (textAlign === 'right') return AlignmentType.RIGHT;
    if (textAlign === 'left') return AlignmentType.LEFT;
    return undefined;
}

function renderListItem(node: RichTextNode, text: string, level: number, kind: 'bullet' | 'number'): Paragraph {
    return new Paragraph({
        text,
        bullet: kind === 'bullet' ? { level } : undefined,
        numbering: kind === 'number' ? { reference: 'default-numbering', level } : undefined,
    });
}

function renderTable(node: RichTextNode): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: (node.content ?? []).map((row) => new TableRow({
            children: (row.content ?? []).map((cell) => new TableCell({
                children: [
                    new Paragraph({
                        children: textRunsFromInline(cell),
                    }),
                ],
            })),
        })),
    });
}

function renderBlocks(node: RichTextNode, listLevel = 0): DocxChild[] {
    switch (node.type) {
        case 'doc':
            return (node.content ?? []).flatMap((child) => renderBlocks(child, listLevel));
        case 'paragraph':
            return [new Paragraph({ children: textRunsFromInline(node), alignment: alignmentFromNode(node) })];
        case 'heading': {
            const level = Math.min(Math.max(getAttrNumber(node, 'level') ?? 1, 1), 6);
            const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level - 1];
            return [new Paragraph({ children: textRunsFromInline(node), heading })];
        }
        case 'blockquote':
            return [new Paragraph({ children: textRunsFromInline(node), indent: { left: 360 } })];
        case 'codeBlock':
            return [new Paragraph({ children: [new TextRun({ text: paragraphText(node), font: 'Courier New' })] })];
        case 'bulletList':
            return (node.content ?? []).map((child) => renderListItem(child, paragraphText(child).trim(), listLevel, 'bullet'));
        case 'orderedList':
            return (node.content ?? []).map((child) => renderListItem(child, paragraphText(child).trim(), listLevel, 'number'));
        case 'taskList':
            return (node.content ?? []).map((child) => {
                const checked = child.attrs?.checked === true ? '[x]' : '[ ]';
                return renderListItem(child, `${checked} ${paragraphText(child).trim()}`, listLevel, 'bullet');
            });
        case 'table':
            return [renderTable(node)];
        case 'image':
            return [new Paragraph({ text: getAttrString(node, 'src') ? `[Image: ${getAttrString(node, 'src')}]` : '[Image]' })];
        default:
            return node.content?.length ? node.content.flatMap((child) => renderBlocks(child, listLevel)) : [];
    }
}

export async function noteToDocxBuffer(note: Note): Promise<Buffer> {
    const doc = new Document({
        numbering: {
            config: [
                {
                    reference: 'default-numbering',
                    levels: [
                        {
                            level: 0,
                            format: 'decimal',
                            text: '%1.',
                            alignment: AlignmentType.LEFT,
                        },
                    ],
                },
            ],
        },
        sections: [
            {
                children: [
                    new Paragraph({
                        text: note.title,
                        heading: HeadingLevel.TITLE,
                    }),
                    new Paragraph({ text: '' }),
                    ...renderBlocks(asRichTextNode(note.content)),
                ],
            },
        ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
}

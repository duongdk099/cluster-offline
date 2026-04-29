import PDFDocument from 'pdfkit';
import { Note } from '../../domain/Note';
import { noteContentToPlainText } from './noteToPlainText';

function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}

export async function noteToPdfBuffer(note: Note): Promise<Buffer> {
    const doc = new PDFDocument({
        margin: 56,
        size: 'A4',
        info: {
            Title: note.title,
        },
    });
    const done = collectPdfBuffer(doc);
    const body = noteContentToPlainText(note.content);

    doc.fontSize(22).font('Helvetica-Bold').text(note.title || 'Untitled', {
        lineGap: 4,
    });
    doc.moveDown();
    doc.fontSize(11).font('Helvetica').fillColor('#666666').text(`Updated ${note.updatedAt.toISOString()}`);
    doc.moveDown();
    doc.fillColor('#111111').fontSize(12).text(body || 'No content', {
        lineGap: 5,
        align: 'left',
    });

    doc.end();
    return done;
}


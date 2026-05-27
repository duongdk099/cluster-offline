import { describe, it, expect } from 'bun:test';
import { extractNoteText } from '../src/application/extractNoteText';

describe('extractNoteText', () => {
    it('returns an empty string for null/undefined/empty content', () => {
        expect(extractNoteText(null)).toBe('');
        expect(extractNoteText(undefined)).toBe('');
        expect(extractNoteText({})).toBe('');
    });

    it('extracts text from a simple paragraph document', () => {
        const doc = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
        };
        expect(extractNoteText(doc)).toBe('Hello world');
    });

    it('joins multiple block nodes with blank lines', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
            ],
        };
        expect(extractNoteText(doc)).toBe('First\n\nSecond');
    });

    it('turns a hardBreak into a newline', () => {
        const doc = {
            type: 'doc',
            content: [{
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Line 1' },
                    { type: 'hardBreak' },
                    { type: 'text', text: 'Line 2' },
                ],
            }],
        };
        expect(extractNoteText(doc)).toBe('Line 1\nLine 2');
    });

    it('extracts nested list item text', () => {
        const doc = {
            type: 'doc',
            content: [{
                type: 'bulletList',
                content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
                ],
            }],
        };
        expect(extractNoteText(doc)).toContain('one');
        expect(extractNoteText(doc)).toContain('two');
    });

    it('collapses non-breaking spaces and excess whitespace', () => {
        const doc = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a   b   c' }] }],
        };
        expect(extractNoteText(doc)).toBe('a b c');
    });
});

import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  stripHtml,
  extractFirstImage,
  normalizeUploadedImageUrl,
} from '~/utils/notes';

// test/setup.ts stubs useRuntimeConfig().public.apiUrl = 'https://api.example.com'.

describe('formatRelativeTime', () => {
  it('returns "Just now" under a minute', () => {
    expect(formatRelativeTime(new Date(Date.now() - 30_000))).toBe('Just now');
  });
  it('returns minutes', () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60_000))).toBe('5m ago');
  });
  it('returns hours', () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 3_600_000))).toBe('3h ago');
  });
  it('returns days', () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 86_400_000))).toBe('2d ago');
  });
});

describe('stripHtml', () => {
  it('returns an empty string for null/undefined', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });
  it('extracts plain text from a tiptap document', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    };
    expect(stripHtml(doc)).toBe('Hello world');
  });
  it('concatenates text across nested nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    const text = stripHtml(doc);
    expect(text).toContain('First');
    expect(text).toContain('Second');
  });
});

describe('normalizeUploadedImageUrl', () => {
  it('rewrites a localhost:3001 url to the configured api url', () => {
    expect(normalizeUploadedImageUrl('http://localhost:3001/uploads/a.png'))
      .toBe('https://api.example.com/uploads/a.png');
  });
  it('rewrites a 127.0.0.1:3001 url too', () => {
    expect(normalizeUploadedImageUrl('http://127.0.0.1:3001/uploads/a.png'))
      .toBe('https://api.example.com/uploads/a.png');
  });
  it('leaves unrelated urls unchanged', () => {
    expect(normalizeUploadedImageUrl('https://cdn.example.org/x.png'))
      .toBe('https://cdn.example.org/x.png');
  });
});

describe('extractFirstImage', () => {
  it('returns the first image src, normalized', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
        { type: 'image', attrs: { src: 'http://localhost:3001/uploads/pic.png' } },
      ],
    };
    expect(extractFirstImage(doc)).toBe('https://api.example.com/uploads/pic.png');
  });
  it('returns null when there is no image', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'no image here' }] }],
    };
    expect(extractFirstImage(doc)).toBeNull();
  });
});

import type { JSONContent } from '@tiptap/core';

function publicApiUrl() {
  const config = useRuntimeConfig();
  return String(config.public.apiUrl || '').replace(/\/$/, '');
}

export function normalizeUploadedImageUrl(src: string): string {
  const apiBase = publicApiUrl();
  if (!apiBase || !src) return src;

  return src
    .replace(/^https?:\/\/localhost:3001(?=\/)/, apiBase)
    .replace(/^https?:\/\/127\.0\.0\.1:3001(?=\/)/, apiBase);
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return then.toLocaleDateString();
}

export function stripHtml(content: JSONContent | string | null | undefined): string {
  if (typeof content === 'string') {
    if (typeof window === 'undefined') return content;
    const doc = new DOMParser().parseFromString(content, 'text/html');
    return doc.body.textContent || '';
  }

  if (!content) return '';

  let text = '';
  if (content.type === 'text') {
    text += content.text || '';
  }
  if (content.content) {
    for (const child of content.content) {
      text += `${stripHtml(child)} `;
    }
  }
  return text.trim();
}

export function extractFirstImage(content: JSONContent | string | null | undefined): string | null {
  if (typeof content === 'string') {
    const match = content.match(/<img [^>]*src="([^"]+)"/);
    return match ? normalizeUploadedImageUrl(match[1]) : null;
  }

  if (!content) return null;

  if (content.type === 'image' && content.attrs?.src) {
    return normalizeUploadedImageUrl(content.attrs.src);
  }

  if (content.content) {
    for (const child of content.content) {
      const img = extractFirstImage(child);
      if (img) return img;
    }
  }
  return null;
}

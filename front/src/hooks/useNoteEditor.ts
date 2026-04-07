
import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Editor, JSONContent } from '@tiptap/core';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { ResizableImage } from '../components/editor/extensions/ResizableImage';
import { Note } from '../lib/types';
import { optimizeImage, cropImage, rotateImage } from '../lib/imageOptimizer';
import { useAuth } from '../contexts/AuthContext';
import { normalizeUploadedImageUrl } from '../lib/utils';
import type { PixelCrop } from 'react-image-crop';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'optimizing' | 'cropping' | 'rotating';

interface UseNoteEditorProps {
    note?: Note | null;
    onSave: (note: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) => void;
    isPending: boolean;
}

function normalizeTagList(input: string[]): string[] {
    return [...new Set(input
        .map((tag) => tag.trim().replace(/\s+/g, ' '))
        .filter(Boolean))];
}

function parseTagDraft(rawInput: string): string[] {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) {
        return [];
    }

    if (trimmedInput.includes(',')) {
        return normalizeTagList(trimmedInput.split(','));
    }

    if (trimmedInput.includes('#')) {
        return normalizeTagList(trimmedInput.split('#'));
    }

    return normalizeTagList([trimmedInput.replace(/^#+/, '')]);
}

function normalizeContentImageUrls(content: JSONContent): JSONContent {
    const next: JSONContent = {
        ...content,
        attrs: content.attrs
            ? {
                ...content.attrs,
                ...(typeof content.attrs.src === 'string'
                    ? { src: normalizeUploadedImageUrl(content.attrs.src) }
                    : {}),
            }
            : content.attrs,
    };

    if (content.content) {
        next.content = content.content.map((child) => normalizeContentImageUrls(child));
    }

    return next;
}

export function useNoteEditor({ note, onSave, isPending }: UseNoteEditorProps) {
    const [title, setTitle] = useState(note?.title || '');
    const [tags, setTags] = useState<string[]>((note?.tags ?? []).map((tag) => tag.name));
    const [tagInput, setTagInput] = useState<string>('');
    const [folderId, setFolderId] = useState<string | null>(note?.folderId ?? null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { token } = useAuth();
    const lastNoteIdRef = useRef<string | null>(null);

    // Use refs to avoid stale closures
    const titleRef = useRef(title);
    titleRef.current = title;
    const tagsRef = useRef(tags);
    tagsRef.current = tags;
    const folderIdRef = useRef(folderId);
    folderIdRef.current = folderId;

    // Keep latest onSave and isPending in refs so triggerAutoSave never goes stale
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;
    const isPendingRef = useRef(isPending);
    isPendingRef.current = isPending;

    useEffect(() => {
        if (note) {
            setTitle(note.title);
            titleRef.current = note.title;
            const noteTags = (note.tags ?? []).map((tag) => tag.name);
            setTags(noteTags);
            tagsRef.current = noteTags;
            setTagInput('');
            setFolderId(note.folderId ?? null);
            folderIdRef.current = note.folderId ?? null;
            // Reset auto-save timer when switching to a different note
            if (note.id !== lastNoteIdRef.current) {
                lastNoteIdRef.current = note.id;
                if (autoSaveTimerRef.current) {
                    clearTimeout(autoSaveTimerRef.current);
                    autoSaveTimerRef.current = null;
                }
            }
        }
    }, [note]);

    const editorRef = useRef<Editor | null>(null);

    // Stable ref to triggerAutoSave — always points to the latest version.
    // This is what the editor's onUpdate calls, avoiding stale closures.
    const triggerAutoSaveRef = useRef<() => void>(() => {});

    // Tracks whether a save was skipped because a previous one was still in flight.
    // When isPending clears, we retry immediately.
    const hasPendingChangesRef = useRef(false);

    const triggerAutoSave = useCallback(() => {
        // If a save is already in flight, mark that we have unsaved changes and bail.
        // The isPending watcher effect below will retry once the current save finishes.
        if (isPendingRef.current) {
            hasPendingChangesRef.current = true;
            return;
        }

        hasPendingChangesRef.current = false;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        setSaveStatus('idle');

        autoSaveTimerRef.current = setTimeout(() => {
            const currentEditor = editorRef.current;
            if (!currentEditor) return;
            const currentContent = currentEditor.getJSON();
            const currentTitle = titleRef.current.trim() || '';
            const currentTags = normalizeTagList(tagsRef.current);
            const currentFolderId = folderIdRef.current;

            // Don't save if content is completely empty
            const isEmpty = !currentContent ||
                (currentContent.content &&
                 currentContent.content.length === 1 &&
                 (!currentContent.content[0]?.content ||
                  currentContent.content[0].content.length === 0));
            if (isEmpty) return;

            setSaveStatus('saving');
            onSaveRef.current({ title: currentTitle, content: currentContent, tags: currentTags, folderId: currentFolderId });
        }, 1000);
    }, []);

    // Keep the ref in sync with the latest callback
    triggerAutoSaveRef.current = triggerAutoSave;



    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            BubbleMenu,
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                bulletList: { keepMarks: true, keepAttributes: false },
                orderedList: { keepMarks: true, keepAttributes: false },
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Table.configure({
                resizable: true,
                HTMLAttributes: { class: 'apple-table' },
            }),
            TableRow,
            TableHeader,
            TableCell,
            ResizableImage.configure({ inline: true, allowBase64: true }),
        ],
        content: note?.content ? normalizeContentImageUrls(note.content) : '',
        onUpdate: ({ editor: e }) => {
            editorRef.current = e;
            triggerAutoSaveRef.current();
        },
        editorProps: {
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        handleFileUpload(file);
                        return true;
                    }
                }
                return false;
            },
            handlePaste: (view, event) => {
                if (event.clipboardData && event.clipboardData.files && event.clipboardData.files[0]) {
                    const file = event.clipboardData.files[0];
                    if (file.type.startsWith('image/')) {
                        handleFileUpload(file);
                        return true;
                    }
                }
                return false;
            },
            attributes: {
                class: 'prose prose-lg dark:prose-invert prose-gray max-w-none focus:outline-none min-h-[500px] font-sans prose-p:my-2 prose-headings:font-bold prose-headings:tracking-tight prose-img:rounded-3xl prose-img:border prose-img:border-apple-border prose-ul:list-disc prose-ol:list-decimal selection:bg-accent/30',
            },
        },
    }, [note?.id]); // Re-init if note ID changes

    useEffect(() => {
        if (editor) {
            editorRef.current = editor;
        }
    }, [editor]);

    const handleFileUpload = async (file: File) => {
        if (!editor || !token) return;

        // Check for HEIC/HEIF format specifically
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

        if (isHeic) {
            alert("HEIC images (iPhone format) are not yet supported. Please upload a JPEG or PNG.");
            return;
        }

        try {
            setSaveStatus('optimizing');
            const optimizedFile = await optimizeImage(file);

            const formData = new FormData();
            formData.append('file', optimizedFile);

            setSaveStatus('saving');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${baseUrl}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();
            const timestampUrl = `${normalizeUploadedImageUrl(data.url)}?v=${Date.now()}`;
            editor.chain().focus().setImage({ src: timestampUrl }).run();
            setSaveStatus('saved');
        } catch (error) {
            console.error('[Editor] Upload error:', error);
            setSaveStatus('idle');
        }
    };

    const handleCrop = async (file: File, pixelCrop: PixelCrop) => {
        if (!editor || !token) return;

        try {
            setSaveStatus('cropping');
            const croppedFile = await cropImage(file, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);

            const formData = new FormData();
            formData.append('file', croppedFile);

            setSaveStatus('saving');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${baseUrl}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) throw new Error('Crop upload failed');

            const data = await response.json();
            const timestampUrl = `${normalizeUploadedImageUrl(data.url)}?v=${Date.now()}`;

            // Replace current selected image in editor
            editor.chain().focus().deleteSelection().setImage({ src: timestampUrl }).run();
            setSaveStatus('saved');
        } catch (error) {
            console.error('[Editor] Crop error:', error);
            setSaveStatus('idle');
        }
    };

    const handleRotate = async (file: File, degrees: number) => {
        if (!editor || !token) return;

        try {
            setSaveStatus('rotating');
            const rotatedFile = await rotateImage(file, degrees);

            const formData = new FormData();
            formData.append('file', rotatedFile);

            setSaveStatus('saving');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${baseUrl}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) throw new Error('Rotate upload failed');

            const data = await response.json();
            const timestampUrl = `${normalizeUploadedImageUrl(data.url)}?v=${Date.now()}`;

            // Replace current selected image in editor
            editor.chain().focus().deleteSelection().setImage({ src: timestampUrl }).run();
            setSaveStatus('saved');
        } catch (error) {
            console.error('[Editor] Rotate error:', error);
            setSaveStatus('idle');
        }
    };

    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        titleRef.current = newTitle;
        triggerAutoSave();
    };

    useEffect(() => {
        // Update status when save completes
        if (!isPending && saveStatus === 'saving') {
            setSaveStatus('saved');
        }

        // When a previous save just finished and we had changes that were skipped,
        // fire the save now so nothing is lost (e.g. an image uploaded during a previous save).
        if (!isPending && hasPendingChangesRef.current) {
            hasPendingChangesRef.current = false;
            triggerAutoSaveRef.current();
        }

        // Auto-hide "Saved" status after 2.5 seconds
        if (saveStatus === 'saved') {
            const timer = setTimeout(() => setSaveStatus('idle'), 2500);
            return () => clearTimeout(timer);
        }
    }, [isPending, saveStatus]);

    // Load content only when switching to a different note (id change).
    // We intentionally do NOT watch the full `note` object to avoid the editor
    // being overwritten by server re-renders while the user is actively editing.
    useEffect(() => {
        if (!editor) return;

        // Switching to a new note (null) - clear editor
        if (note === null) {
            editor.commands.clearContent();
            setTitle('');
            setTags([]);
            tagsRef.current = [];
            setTagInput('');
            setFolderId(null);
            folderIdRef.current = null;
            titleRef.current = '';
            return;
        }

        // Load content for this note ID
        if (note?.content) {
            editor.commands.setContent(normalizeContentImageUrls(note.content));
            setTitle(note.title || '');
            const noteTags = (note.tags ?? []).map((tag) => tag.name);
            setTags(noteTags);
            tagsRef.current = noteTags;
            setTagInput('');
            setFolderId(note.folderId ?? null);
            folderIdRef.current = note.folderId ?? null;
            titleRef.current = note.title || '';
        }
    }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTagInputChange = (nextValue: string) => {
        setTagInput(nextValue);
    };

    const handleAddTag = (rawTagInput: string = tagInput) => {
        const parsedTags = parseTagDraft(rawTagInput);
        if (!parsedTags.length) {
            setTagInput('');
            return false;
        }

        const nextTags = normalizeTagList([...tags, ...parsedTags]);
        setTags(nextTags);
        tagsRef.current = nextTags;
        setTagInput('');
        triggerAutoSave();
        return true;
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const normalizedTagToRemove = tagToRemove.trim().toLowerCase();
        const nextTags = tags.filter((tag) => tag.trim().toLowerCase() !== normalizedTagToRemove);
        setTags(nextTags);
        tagsRef.current = nextTags;
        setTagInput('');
        triggerAutoSave();
    };

    const handleFolderChange = (nextFolderId: string | null) => {
        setFolderId(nextFolderId);
        folderIdRef.current = nextFolderId;
        triggerAutoSave();
    };

    return {
        editor,
        title,
        tags,
        tagInput,
        folderId,
        saveStatus,
        handleTitleChange,
        handleTagInputChange,
        handleAddTag,
        handleRemoveTag,
        handleFolderChange,
        handleFileUpload,
        handleCrop,
        handleRotate,
        setSaveStatus
    };
}

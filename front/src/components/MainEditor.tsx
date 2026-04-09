'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Share, Trash2, AlignLeft, AlignCenter, AlignRight, Crop, RotateCw, FolderOpen, ChevronDown, Plus, X } from 'lucide-react';
import { Note } from '../lib/types';
import { useNoteEditor } from '../hooks/useNoteEditor';
import { useFolders } from '../hooks/useNotes';
import { EditorToolbar, ToolbarButton } from './editor/EditorToolbar';
import { StatusBadge } from './editor/StatusBadge';
import { ImageCropModal } from './editor/ImageCropModal';
import type { JSONContent } from '@tiptap/core';
import { normalizeUploadedImageUrl } from '../lib/utils';

interface MainEditorProps {
    note?: Note | null;
    onSave: (note: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) => void;
    onDelete?: () => void;
    isPending: boolean;
}

export function MainEditor({ note, onSave, onDelete, isPending }: MainEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);
    const [cropImageInfo, setCropImageInfo] = useState<{ src: string; file: File } | null>(null);
    const [isTagComposerOpen, setIsTagComposerOpen] = useState(false);
    const createdAtDate = note?.createdAt ? new Date(note.createdAt) : null;
    const { data: folders = [] } = useFolders();

    // Everything complex is now hidden in this hook
    const {
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
        handleRotate
    } = useNoteEditor({ note, onSave, isPending });

    const selectedFolder = folders.find((folder) => folder.id === folderId) ?? null;

    useEffect(() => {
        if (!isTagComposerOpen) {
            return;
        }

        tagInputRef.current?.focus();
    }, [isTagComposerOpen]);

    if (note === undefined) {
        return <EmptyState />;
    }

    const commitTagComposer = () => {
        const didAddTag = handleAddTag();
        setIsTagComposerOpen(false);
        return didAddTag;
    };

    const startRotate = async (degrees: number) => {
        if (!editor || saveStatus === 'rotating' || saveStatus === 'saving') return;
        const attrs = editor.getAttributes('image');
        if (attrs.src) {
            let fullUrl = normalizeUploadedImageUrl(attrs.src.split('?')[0]);
            if (!fullUrl.startsWith('http')) {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                fullUrl = baseUrl + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
            }

            try {
                const response = await fetch(fullUrl);
                const blob = await response.blob();
                const file = new File([blob], 'image-to-rotate.webp', { type: blob.type });
                handleRotate(file, degrees);
            } catch (e) {
                console.error('Failed to fetch image for rotating', e);
            }
        }
    };

    const startCrop = async () => {
        if (!editor) return;
        const attrs = editor.getAttributes('image');
        if (attrs.src) {
            // Ensure absolute URL
            let fullUrl = normalizeUploadedImageUrl(attrs.src.split('?')[0]);
            if (!fullUrl.startsWith('http')) {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                fullUrl = baseUrl + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
            }

            try {
                const response = await fetch(fullUrl);
                const blob = await response.blob();
                const file = new File([blob], 'image-to-crop.webp', { type: blob.type });
                setCropImageInfo({ src: attrs.src, file });
            } catch (e) {
                console.error('Failed to fetch image for cropping', e);
            }
        }
    };

    return (
        <div
            data-component="MainEditor"
            className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative paper-texture"
        >
            {/* CLEAN HEADER SECTION */}
            <header data-slot="header" className="editor-header">
                <EditorToolbar
                    editor={editor}
                    onAddImage={() => fileInputRef.current?.click()}
                />

                <div data-slot="header-actions" className="flex items-center gap-2 md:gap-3 ml-auto">
                    <StatusBadge status={saveStatus} createdAt={note?.createdAt} updatedAt={note?.updatedAt} />

                    <div data-slot="note-actions" className="flex items-center gap-1">
                        <ToolbarButton icon={<Share size={18} />} onClick={() => { }} title="Share" />
                        <ToolbarButton
                            icon={<Trash2 size={18} />}
                            onClick={() => {
                                if (onDelete && confirm('Are you sure?')) {
                                    onDelete();
                                }
                            }}
                            title="Delete"
                        />
                    </div>
                </div>
            </header>

            {/* SCROLLABLE CONTENT AREA */}
            <main data-slot="content-scroll" className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div data-slot="content-container" className="editor-content-container">
                    <span data-slot="created-at" className="date-label">
                        {createdAtDate
                            ? `${createdAtDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${createdAtDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Draft'}
                    </span>

                    <input
                        data-slot="title-input"
                        type="text"
                        placeholder="Title"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && editor?.commands.focus()}
                        className="title-input transition-all focus:pl-1"
                    />

                    <div data-slot="metadata-row" className="mt-4 flex flex-wrap items-center gap-2.5">
                        <label
                            data-slot="folder-picker"
                            className="group relative inline-flex items-center gap-2 rounded-full border border-apple-border bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-gray-600 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-colors hover:border-accent/25 hover:bg-white dark:hover:bg-white/8"
                        >
                            <FolderOpen size={14} className="text-gray-400 transition-colors group-hover:text-accent" />
                            <span className="pointer-events-none pr-4 font-medium text-gray-700 dark:text-gray-200">
                                {selectedFolder?.name ?? 'Add Folder'}
                            </span>
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={folderId ?? ''}
                                onChange={(e) => handleFolderChange(e.target.value || null)}
                                className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
                                aria-label="Select folder"
                            >
                                <option value="">No Folder</option>
                                {folders.map((folder) => (
                                    <option key={folder.id} value={folder.id}>
                                        {folder.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div data-slot="tag-list" className="flex flex-1 flex-wrap items-center gap-2 min-w-[240px]">
                            {tags.map((tag) => (
                                <button
                                    key={tag}
                                    data-slot="tag-chip"
                                    data-tag-name={tag}
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="group inline-flex items-center gap-1.5 rounded-full border border-apple-border bg-black/[0.03] px-3 py-1.5 text-xs font-semibold tracking-[0.02em] text-gray-600 transition-all hover:border-accent/30 hover:bg-accent/10 hover:text-gray-900 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.10]"
                                    title={`Remove #${tag}`}
                                >
                                    <span>#{tag}</span>
                                    <X size={12} className="opacity-40 transition-opacity group-hover:opacity-100" />
                                </button>
                            ))}

                            {isTagComposerOpen ? (
                                <input
                                    ref={tagInputRef}
                                    data-slot="tag-input"
                                    type="text"
                                    placeholder="Add tag"
                                    value={tagInput}
                                    onChange={(e) => handleTagInputChange(e.target.value)}
                                    onBlur={() => commitTagComposer()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            commitTagComposer();
                                        }

                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleTagInputChange('');
                                            setIsTagComposerOpen(false);
                                        }
                                    }}
                                    className="min-w-[132px] rounded-full border border-dashed border-apple-border bg-transparent px-3 py-1.5 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-accent/40 dark:text-gray-200"
                                />
                            ) : (
                                <button
                                    type="button"
                                    data-slot="tag-add-button"
                                    onClick={() => setIsTagComposerOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-apple-border bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 transition-colors hover:border-accent/30 hover:text-accent"
                                >
                                    <Plus size={12} />
                                    {tags.length > 0 ? 'Tag' : 'Add Tag'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div data-slot="editor-body" className="min-h-[60vh] prose-container">
                        {editor && (
                            <BubbleMenu editor={editor} shouldShow={({ editor }) => editor.isActive('image')}>
                                <div data-slot="image-bubble-menu" className="flex items-center p-1 bg-white dark:bg-zinc-900 border border-apple-border rounded-xl shadow-xl gap-0.5 glass">
                                    <ToolbarButton icon={<AlignLeft size={16} />} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left" />
                                    <ToolbarButton icon={<AlignCenter size={16} />} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center" />
                                    <ToolbarButton icon={<AlignRight size={16} />} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right" />
                                    <div className="w-px h-4 mx-1 bg-apple-border" />
                                    <ToolbarButton icon={<RotateCw size={16} />} onClick={() => startRotate(90)} title="Rotate 90°" />
                                    <ToolbarButton icon={<Crop size={16} />} onClick={startCrop} title="Crop Image" />
                                </div>
                            </BubbleMenu>
                        )}
                        <EditorContent data-slot="editor-content" editor={editor} />
                    </div>
                </div>
            </main>

            {/* MODALS & HIDDEN INPUTS */}
            {cropImageInfo && (
                <ImageCropModal
                    imageUrl={cropImageInfo.src}
                    onCancel={() => setCropImageInfo(null)}
                    onCrop={(pixelCrop) => {
                        handleCrop(cropImageInfo.file, pixelCrop);
                        setCropImageInfo(null);
                    }}
                />
            )}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                }}
            />
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 paper-texture">
            <div className="relative">
                <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full" />
                <div className="relative w-32 h-32 bg-zinc-100 dark:bg-zinc-800 rounded-[3rem] flex items-center justify-center shadow-2xl backdrop-blur-sm border border-apple-border">
                    <span className="text-6xl drop-shadow-md">📒</span>
                </div>
            </div>
            <div className="space-y-3 max-w-sm">
                <h3 className="text-3xl font-bold tracking-tight italic">Notes</h3>
                <p className="text-zinc-500 font-medium">
                    Select a note from the sidebar to start writing, or capture a new thought.
                </p>
            </div>
        </div>
    );
}

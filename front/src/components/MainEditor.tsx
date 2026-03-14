'use client';

import { useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Share, Trash2, AlignLeft, AlignCenter, AlignRight, Crop, RotateCw } from 'lucide-react';
import { Note } from '../lib/types';
import { useNoteEditor } from '../hooks/useNoteEditor';
import { EditorToolbar, ToolbarButton } from './editor/EditorToolbar';
import { StatusBadge } from './editor/StatusBadge';
import { ImageCropModal } from './editor/ImageCropModal';
import type { JSONContent } from '@tiptap/core';

interface MainEditorProps {
    note?: Note | null;
    onSave: (note: { title: string; content: JSONContent }) => void;
    onDelete?: () => void;
    isPending: boolean;
}

export function MainEditor({ note, onSave, onDelete, isPending }: MainEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [cropImageInfo, setCropImageInfo] = useState<{ src: string; file: File } | null>(null);

    // Everything complex is now hidden in this hook
    const {
        editor,
        title,
        saveStatus,
        handleTitleChange,
        handleFileUpload,
        handleCrop,
        handleRotate
    } = useNoteEditor({ note, onSave, isPending });

    if (note === undefined) {
        return <EmptyState />;
    }

    const startRotate = async (degrees: number) => {
        if (!editor || saveStatus === 'rotating' || saveStatus === 'saving') return;
        const attrs = editor.getAttributes('image');
        if (attrs.src) {
            let fullUrl = attrs.src.split('?')[0];
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
            let fullUrl = attrs.src.split('?')[0];
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
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative paper-texture">
            {/* CLEAN HEADER SECTION */}
            <header className="editor-header">
                <EditorToolbar
                    editor={editor}
                    onAddImage={() => fileInputRef.current?.click()}
                />

                <div className="flex items-center gap-3">
                    <StatusBadge status={saveStatus} createdAt={note?.createdAt} />

                    <div className="flex items-center gap-1">
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
            <main className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="editor-content-container">
                    <span className="date-label">
                        {new Date(note?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(note?.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <input
                        type="text"
                        placeholder="Title"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && editor?.commands.focus()}
                        className="title-input transition-all focus:pl-1"
                    />

                    <div className="min-h-[60vh] prose-container">
                        {editor && (
                            <BubbleMenu editor={editor} shouldShow={({ editor }: any) => editor.isActive('image')}>
                                <div className="flex items-center p-1 bg-white dark:bg-zinc-900 border border-apple-border rounded-xl shadow-xl gap-0.5 glass">
                                    <ToolbarButton icon={<AlignLeft size={16} />} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left" />
                                    <ToolbarButton icon={<AlignCenter size={16} />} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center" />
                                    <ToolbarButton icon={<AlignRight size={16} />} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right" />
                                    <div className="w-px h-4 mx-1 bg-apple-border" />
                                    <ToolbarButton icon={<RotateCw size={16} />} onClick={() => startRotate(90)} title="Rotate 90°" />
                                    <ToolbarButton icon={<Crop size={16} />} onClick={startCrop} title="Crop Image" />
                                </div>
                            </BubbleMenu>
                        )}
                        <EditorContent editor={editor} />
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

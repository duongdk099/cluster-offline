'use client';

import {
    FolderIcon,
    Trash2Icon,
    TagIcon,
    PlusIcon,
    SearchIcon,
    LogOutIcon
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAssignFolderToNote, useCreateFolder, useDeletedNotes, useFolders, useTags } from '../hooks/useNotes';

interface SidebarProps {
    onNewNote: () => void;
    onLogout: () => void;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    selectedTag?: string;
    selectedFolder?: string;
    onSelectTag?: (tag: string) => void;
    onSelectFolder?: (folder: string) => void;
}

export function Sidebar({
    onNewNote,
    onLogout,
    searchQuery,
    onSearchChange,
    selectedTag,
    selectedFolder,
    onSelectTag,
    onSelectFolder,
}: SidebarProps) {
    const router = useRouter();
    const [fallbackQuery, setFallbackQuery] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const { data: deletedNotes } = useDeletedNotes();
    const { data: tags = [] } = useTags();
    const { data: folders = [] } = useFolders();
    const createFolder = useCreateFolder();
    const assignFolderToNote = useAssignFolderToNote();
    const pathname = usePathname();
    const deletedCount = deletedNotes?.length || 0;
    const query = onSearchChange ? (searchQuery || '') : fallbackQuery;
    const isAllNotesActive = pathname === '/';
    const isDeletedActive = pathname === '/notes/deleted';

    const handleCreateFolder = async () => {
        const trimmed = newFolderName.trim();
        if (!trimmed) return;
        await createFolder.mutateAsync({ name: trimmed });
        setNewFolderName('');
    };

    const handleSelectTag = (tagId: string) => {
        const next = selectedTag === tagId ? '' : tagId;

        if (onSelectTag) {
            onSelectFolder?.('');
            onSelectTag(next);
            return;
        }

        if (!next) {
            router.push('/');
            return;
        }

        router.push(`/?tag=${encodeURIComponent(next)}`);
    };

    const handleSelectFolder = (folderId: string) => {
        const next = selectedFolder === folderId ? '' : folderId;

        if (onSelectFolder) {
            onSelectTag?.('');
            onSelectFolder(next);
            return;
        }

        if (!next) {
            router.push('/');
            return;
        }

        router.push(`/?folder=${encodeURIComponent(next)}`);
    };

    const handleDropOnFolder = async (folderId: string, e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setDragOverFolderId(null);

        const noteId = e.dataTransfer.getData('text/plain');
        if (!noteId) return;

        await assignFolderToNote.mutateAsync({ id: noteId, folderId });
    };

    return (
        <aside className="w-68 h-full bg-sidebar-bg flex flex-col">
            <div className="p-4 space-y-6 flex-1 overflow-y-auto pt-8">
                {/* Search Bar */}
                <div className="relative group px-1">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search"
                        value={query}
                        onChange={(e) => {
                            const next = e.target.value;
                            if (onSearchChange) {
                                onSearchChange(next);
                                return;
                            }
                            setFallbackQuery(next);
                        }}
                        className="w-full bg-black/5 dark:bg-white/5 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] outline-none transition-all placeholder:text-gray-400"
                    />
                </div>

                {/* Navigation Sections */}
                <nav className="space-y-6">
                    <div>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2 opacity-60">Library</h3>
                        <ul className="space-y-0.5">
                            <Link href="/">
                                <SidebarItem
                                    icon={<FolderIcon size={18} />}
                                    label="All Notes"
                                    active={isAllNotesActive && !selectedTag && !selectedFolder}
                                    onClick={() => {
                                        onSelectTag?.('');
                                        onSelectFolder?.('');
                                    }}
                                />
                            </Link>
                            <Link href="/notes/deleted">
                                <SidebarItem 
                                    icon={<Trash2Icon size={18} />} 
                                    label="Recently Deleted" 
                                    active={isDeletedActive}
                                    count={deletedCount > 0 ? deletedCount : undefined}
                                />
                            </Link>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2 opacity-60">Tags</h3>
                        <ul className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {tags.length === 0 && (
                                <li className="px-4 py-1.5 text-[12px] text-gray-400">No tags yet</li>
                            )}
                            {tags.map((tag) => (
                                <SidebarItem
                                    key={tag.id}
                                    icon={<TagIcon size={16} />}
                                    label={`#${tag.name}`}
                                    active={selectedTag === tag.id}
                                    onClick={() => handleSelectTag(tag.id)}
                                />
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2 opacity-60">Folders</h3>

                        <div className="mx-2 rounded-2xl border border-apple-border/70 bg-white/55 dark:bg-white/5 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                            <ul className="space-y-0.5 max-h-44 overflow-y-auto custom-scrollbar p-1.5">
                                {folders.length === 0 && (
                                    <li className="px-3 py-2 text-[12px] text-gray-400">No folders yet</li>
                                )}
                                {folders.map((folder) => (
                                    <SidebarItem
                                        key={folder.id}
                                        icon={<FolderIcon size={16} />}
                                        label={folder.name}
                                        active={selectedFolder === folder.id}
                                        isDropTarget={dragOverFolderId === folder.id}
                                        onClick={() => handleSelectFolder(folder.id)}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDragOverFolderId(folder.id);
                                        }}
                                        onDragLeave={() => setDragOverFolderId(null)}
                                        onDrop={(e) => void handleDropOnFolder(folder.id, e)}
                                    />
                                ))}
                            </ul>

                            <div className="border-t border-apple-border/70 p-1.5 flex items-center gap-1.5">
                                <input
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            void handleCreateFolder();
                                        }
                                    }}
                                    placeholder="New Folder"
                                    className="flex-1 bg-transparent rounded-lg py-1.5 px-2.5 text-[12px] outline-none placeholder:text-gray-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleCreateFolder()}
                                    className="h-7 w-7 rounded-md text-[14px] font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 flex items-center justify-center"
                                    aria-label="Add folder"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2 opacity-60">iCloud</h3>
                        <ul className="space-y-0.5">
                            <SidebarItem icon={<FolderIcon size={18} />} label="Notes" />
                        </ul>
                    </div>
                </nav>
            </div>

            {/* Bottom Toolbar - Apple Style */}
            <div className="p-2 border-t border-apple-border bg-sidebar-bg/60 backdrop-blur-md flex items-center justify-between">
                <button
                    onClick={onLogout}
                    className="p-2 text-gray-500 hover:text-accent transition-colors"
                >
                    <LogOutIcon size={18} />
                </button>
                <button
                    onClick={onNewNote}
                    className="p-2 text-accent hover:opacity-80 transition-all active:scale-95"
                >
                    <PlusIcon size={24} strokeWidth={2.5} />
                </button>
            </div>
        </aside>
    );
}

function SidebarItem({
    icon,
    label,
    active = false,
    count,
    onClick,
    onDrop,
    onDragOver,
    onDragLeave,
    isDropTarget = false,
}: {
    icon: React.ReactNode,
    label: string,
    active?: boolean,
    count?: number,
    onClick?: () => void,
    onDrop?: (e: React.DragEvent<HTMLButtonElement>) => void,
    onDragOver?: (e: React.DragEvent<HTMLButtonElement>) => void,
    onDragLeave?: () => void,
    isDropTarget?: boolean,
}) {
    return (
        <li>
            <button
                onClick={onClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`w-full flex items-center justify-between px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${active
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                    } ${isDropTarget ? 'ring-2 ring-accent/50 bg-accent/10' : ''}`}
            >
                <div className="flex items-center space-x-3">
                    <span className={active ? 'text-white' : 'text-accent'}>{icon}</span>
                    <span>{label}</span>
                </div>
                {count !== undefined && (
                    <span className={`text-[11px] font-bold ${active ? 'text-white/80' : 'text-gray-400'}`}>
                        {count}
                    </span>
                )}
            </button>
        </li>
    );
}

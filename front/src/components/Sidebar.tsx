'use client';

import {
    FolderIcon,
    Trash2Icon,
    TagIcon,
    PlusIcon,
    SearchIcon,
    LogOutIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDeletedNotes } from '../hooks/useNotes';

interface SidebarProps {
    onNewNote: () => void;
    onLogout: () => void;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
}

export function Sidebar({ onNewNote, onLogout, searchQuery, onSearchChange }: SidebarProps) {
    const router = useRouter();
    const [localQuery, setLocalQuery] = useState('');
    const { data: deletedNotes } = useDeletedNotes();
    const deletedCount = deletedNotes?.length || 0;

    // Debounce search (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (onSearchChange && localQuery !== searchQuery) {
                onSearchChange(localQuery);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [localQuery, onSearchChange, searchQuery]);

    return (
        <aside className="w-[260px] h-screen bg-sidebar-bg flex flex-col border-r border-apple-border">
            <div className="p-4 space-y-6 flex-1 overflow-y-auto pt-12">
                {/* Search Bar */}
                <div className="relative group px-1">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search"
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                        className="w-full bg-black/5 dark:bg-white/5 border-none rounded-lg py-1.5 pl-9 pr-4 text-[13px] outline-none transition-all placeholder:text-gray-400"
                    />
                </div>

                {/* Navigation Sections */}
                <nav className="space-y-6">
                    <div>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2 opacity-60">Library</h3>
                        <ul className="space-y-0.5">
                            <Link href="/">
                                <SidebarItem icon={<FolderIcon size={18} />} label="All Notes" active={!searchQuery} />
                            </Link>
                            <SidebarItem icon={<TagIcon size={18} />} label="Smart Folders" />
                            <Link href="/notes/deleted">
                                <SidebarItem 
                                    icon={<Trash2Icon size={18} />} 
                                    label="Recently Deleted" 
                                    count={deletedCount > 0 ? deletedCount : undefined}
                                />
                            </Link>
                        </ul>
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
            <div className="p-2 border-t border-apple-border bg-sidebar-bg/50 backdrop-blur-md flex items-center justify-between">
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

function SidebarItem({ icon, label, active = false, count }: { icon: React.ReactNode, label: string, active?: boolean, count?: number }) {
    return (
        <li>
            <button className={`w-full flex items-center justify-between px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${active
                ? 'bg-accent text-white shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                }`}>
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

import { NoteSummary } from '../lib/types';
import { NoteCard } from './NoteCard';
import { SearchIcon, XIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

interface NoteListProps {
    notes?: NoteSummary[];
    isLoading: boolean;
    isError: boolean;
    selectedId?: string;
    onSelect: (note: NoteSummary) => void;
    searchQuery?: string;
    onClearSearch?: () => void;
}

export function NoteList({ notes, isLoading, isError, selectedId, onSelect, searchQuery, onClearSearch }: NoteListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const itemHeight = 92;
    const overscan = 10;
    const viewportHeight = 560;
    const totalCount = notes?.length || 0;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(totalCount, startIndex + visibleCount);
    const visibleNotes = useMemo(() => notes?.slice(startIndex, endIndex) ?? [], [notes, startIndex, endIndex]);
    const topSpacerHeight = startIndex * itemHeight;
    const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * itemHeight);

    if (isLoading) {
        return (
            <div data-component="NoteListLoading" className="w-full md:w-84 border-b md:border-b-0 md:border-r border-apple-border h-full bg-white/80 dark:bg-black/20 overflow-hidden">
                <div data-slot="header-skeleton" className="px-4 md:pl-12 border-b border-apple-border flex items-center h-13">
                    <div className="h-6 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse w-full max-w-30" />
                </div>
                <div className="space-y-0">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="px-4 py-3.5 border-b border-apple-border/50 animate-pulse flex gap-3">
                            <div className="flex-1 space-y-2">
                                <div className="h-3.5 bg-gray-100 dark:bg-white/5 rounded w-3/4" />
                                <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded w-1/2" />
                            </div>
                            <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div data-component="NoteListError" className="w-full md:w-84 border-b md:border-b-0 md:border-r border-apple-border h-full flex items-center justify-center p-8 text-center bg-white/80 dark:bg-black/20 paper-texture">
                <p className="text-sm text-red-500 font-medium">Failed to load notes.</p>
            </div>
        );
    }

    const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;
    const showNoResults = hasSearchQuery && notes && notes.length === 0;

    return (
        <div data-component="NoteList" className="w-full md:w-84 flex flex-col border-b md:border-b-0 md:border-r border-apple-border h-full bg-white/85 dark:bg-black/20 overflow-hidden">
            {/* Note List Header */}
            <div data-slot="header" className="h-13 px-4 flex items-center justify-between border-b border-apple-border/50 bg-white/70 dark:bg-black/5 backdrop-blur-md">
                <div data-slot="header-title" className="flex items-center gap-2">
                    {hasSearchQuery && (
                        <SearchIcon size={14} className="text-gray-400" />
                    )}
                    <h2 className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-widest pl-1 md:pl-2">
                        {hasSearchQuery ? 'Search Results' : 'Notes'}
                    </h2>
                </div>
                <div data-slot="header-actions" className="flex items-center gap-2">
                    <div data-slot="count" className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[11px] font-bold text-gray-500">
                        {totalCount}
                    </div>
                    {hasSearchQuery && onClearSearch && (
                        <button
                            data-slot="clear-search"
                            onClick={onClearSearch}
                            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                        >
                            <XIcon size={12} className="text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            <div
                ref={scrollRef}
                data-slot="list-scroll"
                className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-2 pb-24 md:px-2 md:pb-12"
                onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
                {showNoResults ? (
                    <div data-slot="empty-search" className="p-8 md:p-12 text-center space-y-3 opacity-40">
                        <div className="text-4xl">🔍</div>
                        <p className="text-[14px] font-bold text-gray-500 italic">No results found</p>
                        <p className="text-[12px] text-gray-400">
                            Try a different search term
                        </p>
                    </div>
                ) : notes?.length === 0 ? (
                    <div data-slot="empty-list" className="p-8 md:p-12 text-center space-y-3 opacity-40">
                        <div className="text-4xl">📭</div>
                        <p className="text-[14px] font-bold text-gray-500 italic">No Notes</p>
                    </div>
                ) : (
                    <div data-slot="list" className="space-y-1.5 md:space-y-0.5">
                        {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} aria-hidden="true" />}
                        {visibleNotes.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                isActive={selectedId === note.id}
                                onClick={() => onSelect(note)}
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', note.id);
                                }}
                            />
                        ))}
                        {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />}
                    </div>
                )}
            </div>
        </div>
    );
}

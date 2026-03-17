import { Note } from '../lib/types';
import { NoteCard } from './NoteCard';
import { SearchIcon, XIcon } from 'lucide-react';

interface NoteListProps {
    notes?: Note[];
    isLoading: boolean;
    isError: boolean;
    selectedId?: string;
    onSelect: (note: Note) => void;
    searchQuery?: string;
    onClearSearch?: () => void;
}

export function NoteList({ notes, isLoading, isError, selectedId, onSelect, searchQuery, onClearSearch }: NoteListProps) {
    if (isLoading) {
        return (
            <div className="w-full md:w-84 border-b md:border-b-0 md:border-r border-apple-border h-full bg-white dark:bg-black/20 overflow-hidden">
                <div className="p-3 pl-12 border-b border-apple-border flex items-center h-13">
                    <div className="h-6 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse w-full max-w-30" />
                </div>
                <div className="space-y-0">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="p-4 border-b border-apple-border/50 animate-pulse flex gap-3">
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
            <div className="w-full md:w-84 border-b md:border-b-0 md:border-r border-apple-border h-full flex items-center justify-center p-8 text-center bg-white dark:bg-black/20 paper-texture">
                <p className="text-sm text-red-500 font-medium">Failed to load notes.</p>
            </div>
        );
    }

    const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;
    const showNoResults = hasSearchQuery && notes && notes.length === 0;

    return (
        <div className="w-full md:w-84 flex flex-col border-b md:border-b-0 md:border-r border-apple-border h-full bg-white dark:bg-black/20 overflow-hidden">
            {/* Note List Header */}
            <div className="h-13 px-4 flex items-center justify-between border-b border-apple-border/50 bg-white/50 dark:bg-black/5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    {hasSearchQuery && (
                        <SearchIcon size={14} className="text-gray-400" />
                    )}
                    <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest pl-2">
                        {hasSearchQuery ? 'Search Results' : 'Notes'}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[11px] font-bold text-gray-500">
                        {notes?.length || 0}
                    </div>
                    {hasSearchQuery && onClearSearch && (
                        <button
                            onClick={onClearSearch}
                            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                        >
                            <XIcon size={12} className="text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-24 md:pb-12">
                {showNoResults ? (
                    <div className="p-12 text-center space-y-3 opacity-40">
                        <div className="text-4xl">🔍</div>
                        <p className="text-[14px] font-bold text-gray-500 italic">No results found</p>
                        <p className="text-[12px] text-gray-400">
                            Try a different search term
                        </p>
                    </div>
                ) : notes?.length === 0 ? (
                    <div className="p-12 text-center space-y-3 opacity-40">
                        <div className="text-4xl">📭</div>
                        <p className="text-[14px] font-bold text-gray-500 italic">No Notes</p>
                    </div>
                ) : (
                    <div className="px-2 space-y-0.5">
                        {notes?.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                isActive={selectedId === note.id}
                                onClick={() => onSelect(note)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

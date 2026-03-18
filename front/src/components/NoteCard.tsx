import { Note } from '../lib/types';
import { formatRelativeTime, stripHtml, extractFirstImage } from '../lib/utils';

interface NoteCardProps {
    note: Note;
    isActive?: boolean;
    onClick?: () => void;
    onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
}

export function NoteCard({ note, isActive, onClick, onDragStart }: NoteCardProps) {
    const snippet = stripHtml(note.content);
    const imageUrl = extractFirstImage(note.content);
    const visibleTags = (note.tags ?? []).slice(0, 3);

    return (
        <button
            type="button"
            draggable
            onClick={onClick}
            onDragStart={onDragStart}
            className={`group w-full text-left px-3.5 py-3.5 cursor-pointer transition-all relative rounded-2xl border ${isActive
                ? 'bg-apple-selection border-accent/35 shadow-sm'
                : 'border-transparent hover:bg-gray-100/70 dark:hover:bg-white/5 hover:border-apple-border/50'
                }`}
        >
            <div className="flex gap-3">
                <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                        <h3 className="font-bold text-[14px] md:text-[15px] truncate text-gray-900 dark:text-gray-100">
                            {note.title || 'New Note'}
                        </h3>
                        {isActive && (
                            <div className="w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_8px_rgba(255,179,0,0.4)]" />
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] md:text-[12px] text-gray-400 whitespace-nowrap font-medium">
                            {formatRelativeTime(note.createdAt)}
                        </span>
                        <p className="text-[12px] md:text-[13px] text-gray-500 line-clamp-1 leading-snug">
                            {snippet || 'No additional text'}
                        </p>
                    </div>

                    {visibleTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {visibleTags.map((tag) => (
                                <span
                                    key={tag.id}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                                >
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {imageUrl && (
                    <div className="shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl overflow-hidden border border-apple-border/50 bg-gray-50 bg-center bg-cover" style={{ backgroundImage: `url(${imageUrl})` }} />
                )}
            </div>

            {/* Inset Separator - only show if not active and last item handled by parent list */}
            {!isActive && (
                <div className="hidden md:block absolute bottom-0 right-0 left-4 h-px bg-apple-border" />
            )}
        </button>
    );
}

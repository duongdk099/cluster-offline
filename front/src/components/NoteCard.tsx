import { Note } from '../lib/types';
import { formatRelativeTime, stripHtml, extractFirstImage } from '../lib/utils';

interface NoteCardProps {
    note: Note;
    isActive?: boolean;
    onClick?: () => void;
}

export function NoteCard({ note, isActive, onClick }: NoteCardProps) {
    const snippet = stripHtml(note.content);
    const imageUrl = extractFirstImage(note.content);

    return (
        <div
            onClick={onClick}
            className={`group px-4 py-3 cursor-pointer transition-all relative ${isActive
                ? 'bg-apple-selection'
                : 'hover:bg-gray-100/50 dark:hover:bg-white/5'
                }`}
        >
            <div className="flex gap-3">
                <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                        <h3 className="font-bold text-[15px] truncate text-gray-900 dark:text-gray-100">
                            {note.title || 'New Note'}
                        </h3>
                        {isActive && (
                            <div className="w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_8px_rgba(255,179,0,0.4)]" />
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[13px] text-gray-400 whitespace-nowrap">
                            {formatRelativeTime(note.createdAt)}
                        </span>
                        <p className="text-[13px] text-gray-500 line-clamp-1 leading-snug">
                            {snippet || 'No additional text'}
                        </p>
                    </div>
                </div>

                {imageUrl && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-apple-border/50 bg-gray-50 bg-center bg-cover" style={{ backgroundImage: `url(${imageUrl})` }} />
                )}
            </div>

            {/* Inset Separator - only show if not active and last item handled by parent list */}
            {!isActive && (
                <div className="absolute bottom-0 right-0 left-4 h-px bg-apple-border" />
            )}
        </div>
    );
}

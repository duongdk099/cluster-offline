'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Note } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import { useDeletedNotes, useRestoreNote, usePermanentDeleteNote } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Trash2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export function DeletedWrapper() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: deletedNotes = [], isLoading } = useDeletedNotes();
  const restoreNote = useRestoreNote();
  const permanentDeleteNote = usePermanentDeleteNote();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    restoreNote.mutate(id, {
      onSuccess: () => setSelectedNoteId(null),
      onError: (err) => console.error('Failed to restore note:', err),
    });
  };

  const handlePermanentDelete = (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    permanentDeleteNote.mutate(id, {
      onSuccess: () => setSelectedNoteId(null),
      onError: (err) => console.error('Failed to delete note:', err),
    });
  };

  const handleEmptyTrash = () => {
    if (!confirm('Delete all notes permanently? This cannot be undone.')) return;
    deletedNotes.forEach((note) => permanentDeleteNote.mutate(note.id));
    setSelectedNoteId(null);
  };

  return (
    <main className="flex h-screen w-full bg-background overflow-hidden relative">
      <div className="hidden md:block">
        <Sidebar onNewNote={() => router.push('/notes/new')} onLogout={logout} />
      </div>

      <div className="w-[320px] flex flex-col border-r border-apple-border h-full bg-white dark:bg-black/20 overflow-hidden">
        <div className="h-[52px] px-4 flex items-center justify-between border-b border-apple-border/50 bg-white/50 dark:bg-black/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Link href="/" className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">Recently Deleted</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[11px] font-bold text-gray-500">
              {deletedNotes.length}
            </div>
            {deletedNotes.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Empty trash"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-2 pb-12">
          {deletedNotes.length === 0 ? (
            <div className="p-12 text-center space-y-3 opacity-40">
              <div className="text-4xl">🗑️</div>
              <p className="text-[14px] font-bold text-gray-500 italic">Trash is empty</p>
            </div>
          ) : (
            <div className="px-2 space-y-0.5">
              {deletedNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id === selectedNoteId ? null : note.id)}
                  className={`group px-4 py-3 cursor-pointer transition-all relative ${
                    note.id === selectedNoteId
                      ? 'bg-apple-selection'
                      : 'hover:bg-gray-100/50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <h3 className="font-bold text-[15px] truncate text-gray-900 dark:text-gray-100">
                        {note.title || ''}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-red-400 whitespace-nowrap">
                        Deleted {formatRelativeTime(note.deletedAt!)}
                      </span>
                    </div>
                  </div>

                  {note.id === selectedNoteId && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(note.id);
                        }}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                        title="Restore"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePermanentDelete(note.id);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 paper-texture">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full" />
          <div className="relative w-32 h-32 bg-zinc-100 dark:bg-zinc-800 rounded-[3rem] flex items-center justify-center shadow-2xl backdrop-blur-sm border border-apple-border">
            <span className="text-6xl drop-shadow-md">🗑️</span>
          </div>
        </div>
        <div className="space-y-3 max-w-sm">
          <h3 className="text-3xl font-bold tracking-tight italic">Recently Deleted</h3>
          <p className="text-zinc-500 font-medium">
            {selectedNoteId
              ? 'Select an action: Restore or Delete Permanently'
              : 'Select a note to preview or take action'}
          </p>
          {selectedNoteId && (
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={() => handleRestore(selectedNoteId)}
                className="px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Restore
              </button>
              <button
                onClick={() => handlePermanentDelete(selectedNoteId)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete Permanently
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

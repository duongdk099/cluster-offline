'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { NoteList } from '@/components/NoteList';
import { MainEditor } from '@/components/MainEditor';
import { useDeleteNote, useNotes, useUpdateNote } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import type { JSONContent } from '@tiptap/core';
import { ChevronDown, ChevronUp, Home, PlusIcon, LogOutIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { NoteTag } from '@/lib/types';

interface EditorWrapperProps {
  note: {
    id: string;
    title: string;
    content: JSONContent;
    tags?: NoteTag[];
    folderId?: string | null;
    createdAt: string;
    updatedAt?: string;
  };
}

export function EditorWrapper({ note }: EditorWrapperProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: notes, isLoading, isError } = useNotes();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [showListMobile, setShowListMobile] = useState(false);
  const [showLeftPanels, setShowLeftPanels] = useState(true);

  const handleSave = (data: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) => {
    updateNote.mutate({ id: note.id, ...data });
  };

  const handleDelete = async () => {
    try {
      await deleteNote.mutateAsync(note.id);
      router.push('/');
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  return (
    <main className="app-shell">
      <div className="app-frame flex flex-col w-full overflow-hidden relative">
        <div className="desktop-window-titlebar hidden md:flex items-center px-4 gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/90" />
          <span className="ml-3 text-[11px] text-gray-500 font-semibold tracking-wide">
            Note Editor
          </span>
          <div className="ml-auto">
            <button
              onClick={() => setShowLeftPanels(!showLeftPanels)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title={showLeftPanels ? "Hide panels" : "Show panels"}
            >
              {showLeftPanels ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>

        <div className="w-full flex flex-col md:flex-row overflow-hidden flex-1">
          <div className="mobile-topbar md:hidden">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => router.push('/')}
                className="p-2 rounded-xl border border-apple-border"
                aria-label="Back to home"
              >
                <Home size={16} />
              </button>

              <button
                onClick={() => setShowListMobile((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-apple-border text-sm font-medium"
              >
                Notes
                {showListMobile ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/notes/new')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  <PlusIcon size={14} />
                  New
                </button>
                <button
                  onClick={logout}
                  className="p-2 rounded-xl border border-apple-border text-gray-600 dark:text-gray-300"
                  aria-label="Log out"
                >
                  <LogOutIcon size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className={`hidden md:block app-panel transition-all duration-300 overflow-hidden ${
            showLeftPanels ? "md:block" : "md:w-0 md:hidden"
          }`}>
            <Sidebar onNewNote={() => router.push('/notes/new')} onLogout={logout} />
          </div>

          <div className={`hidden md:block app-section transition-all duration-300 overflow-hidden ${
            showLeftPanels ? "md:block" : "md:w-0 md:hidden"
          }`}>
            <NoteList
              notes={notes}
              isLoading={isLoading}
              isError={isError}
              selectedId={note.id}
              onSelect={(n) => router.push(`/notes/${n.id}`)}
            />
          </div>

          {showListMobile && (
            <div className="mobile-sheet md:hidden">
              <NoteList
                notes={notes}
                isLoading={isLoading}
                isError={isError}
                selectedId={note.id}
                onSelect={(n) => {
                  setShowListMobile(false);
                  router.push(`/notes/${n.id}`);
                }}
              />
            </div>
          )}

          <MainEditor
            key={note.id}
            note={note}
            onSave={handleSave}
            onDelete={handleDelete}
            isPending={updateNote.isPending}
          />
        </div>
      </div>
    </main>
  );
}

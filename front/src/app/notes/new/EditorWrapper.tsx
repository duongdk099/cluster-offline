'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { NoteList } from '@/components/NoteList';
import { MainEditor } from '@/components/MainEditor';
import { createNote } from '@/app/actions/notes';
import { useNotes } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import type { JSONContent } from '@tiptap/core';
import { ChevronDown, ChevronUp, Home, LogOutIcon } from 'lucide-react';

export function EditorWrapper() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: notes, isLoading, isError } = useNotes();
  const [isPending, startTransition] = useTransition();
  const [showListMobile, setShowListMobile] = useState(false);

  const handleSave = (data: { title: string; content: JSONContent }) => {
    startTransition(async () => {
      const result = await createNote(data);
      if (result?.error) {
        console.error('Failed to create note:', result.error);
      }
      // Redirect happens in server action on success
    });
  };

  return (
    <main className="flex flex-col md:flex-row h-screen w-full bg-background overflow-auto md:overflow-hidden relative">
      <div className="md:hidden sticky top-0 z-40 border-b border-apple-border bg-background/90 backdrop-blur-xl px-4 py-3">
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
          <button
            onClick={logout}
            className="p-2 rounded-xl border border-apple-border text-gray-600 dark:text-gray-300"
            aria-label="Log out"
          >
            <LogOutIcon size={16} />
          </button>
        </div>
      </div>
      <div className="hidden md:block">
        <Sidebar onNewNote={() => {}} onLogout={logout} />
      </div>
      <div className="hidden md:block">
        <NoteList
          notes={notes}
          isLoading={isLoading}
          isError={isError}
          selectedId={undefined}
          onSelect={(n) => router.push(`/notes/${n.id}`)}
        />
      </div>
      {showListMobile && (
        <div className="md:hidden">
          <NoteList
            notes={notes}
            isLoading={isLoading}
            isError={isError}
            selectedId={undefined}
            onSelect={(n) => {
              setShowListMobile(false);
              router.push(`/notes/${n.id}`);
            }}
          />
        </div>
      )}
      <MainEditor
        key="new"
        note={null}
        onSave={handleSave}
        isPending={isPending}
      />
    </main>
  );
}

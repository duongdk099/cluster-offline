'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { NoteList } from '@/components/NoteList';
import { MainEditor } from '@/components/MainEditor';
import { createNote } from '@/app/actions/notes';
import { useNotes } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import type { JSONContent } from '@tiptap/core';

export function EditorWrapper() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: notes, isLoading, isError } = useNotes();
  const [isPending, startTransition] = useTransition();

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
    <main className="flex h-screen w-full bg-background overflow-hidden relative">
      <div className="hidden md:block">
        <Sidebar onNewNote={() => {}} onLogout={logout} />
      </div>
      <NoteList
        notes={notes}
        isLoading={isLoading}
        isError={isError}
        selectedId={undefined}
        onSelect={(n) => router.push(`/notes/${n.id}`)}
      />
      <MainEditor
        key="new"
        note={null}
        onSave={handleSave}
        isPending={isPending}
      />
    </main>
  );
}

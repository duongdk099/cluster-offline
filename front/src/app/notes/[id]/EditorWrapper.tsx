'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { NoteList } from '@/components/NoteList';
import { MainEditor } from '@/components/MainEditor';
import { deleteNote } from '@/app/actions/notes';
import { useNotes, useUpdateNote } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import type { JSONContent } from '@tiptap/core';

interface EditorWrapperProps {
  note: {
    id: string;
    title: string;
    content: JSONContent;
    createdAt: string;
  };
}

export function EditorWrapper({ note }: EditorWrapperProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: notes, isLoading, isError } = useNotes();
  const updateNote = useUpdateNote();

  const handleSave = (data: { title: string; content: JSONContent }) => {
    updateNote.mutate({ id: note.id, ...data });
  };

  const handleDelete = async () => {
    const result = await deleteNote(note.id);
    if (result?.error) {
      console.error('Failed to delete note:', result.error);
    } else {
      router.push('/');
    }
  };

  return (
    <main className="flex h-screen w-full bg-background overflow-hidden relative">
      <div className="hidden md:block">
        <Sidebar onNewNote={() => router.push('/notes/new')} onLogout={logout} />
      </div>
      <NoteList
        notes={notes}
        isLoading={isLoading}
        isError={isError}
        selectedId={note.id}
        onSelect={(n) => router.push(`/notes/${n.id}`)}
      />
      <MainEditor
        key={note.id}
        note={note}
        onSave={handleSave}
        onDelete={handleDelete}
        isPending={updateNote.isPending}
      />
    </main>
  );
}

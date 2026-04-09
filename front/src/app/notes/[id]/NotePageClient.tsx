'use client';

import { EditorWrapper } from './EditorWrapper';
import { useLocalFirstNote } from '@/hooks/useLocalFirstNote';

export function NotePageClient({ id }: { id: string }) {
  const { data: note, isLoading, isError } = useLocalFirstNote(id);

  if (isLoading) {
    return null;
  }

  if (isError || !note) {
    return (
      <main className="app-shell">
        <div className="app-frame flex items-center justify-center p-10">
          <p className="text-sm text-red-500 font-medium">Note not found.</p>
        </div>
      </main>
    );
  }

  return <EditorWrapper note={note} />;
}

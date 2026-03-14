import { getNote } from '@/app/actions/notes';
import { EditorWrapper } from './EditorWrapper';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotePage({ params }: PageProps) {
  const { id } = await params;
  const note = await getNote(id);

  if (!note) {
    notFound();
  }

  return <EditorWrapper note={note} />;
}

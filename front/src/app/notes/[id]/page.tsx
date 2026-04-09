import { getNote } from '@/app/actions/notes';
import { EditorWrapper } from './EditorWrapper';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotePage({ params }: PageProps) {
  const { id } = await params;
  const result = await getNote(id);

  if (!result.success) {
    notFound();
  }

  const note = result.data;
  return <EditorWrapper note={note} />;
}

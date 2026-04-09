import { NotePageClient } from './NotePageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotePage({ params }: PageProps) {
  const { id } = await params;
  return <NotePageClient id={id} />;
}

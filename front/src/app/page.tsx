"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { NoteList } from "@/components/NoteList";
import { useNotes, useSearchNotes } from "@/hooks/useNotes";
import { stripHtml, extractFirstImage, formatRelativeTime } from "@/lib/utils";
import { PlusIcon, FileTextIcon, CalendarIcon, ClockIcon } from "lucide-react";
import { Note } from "@/lib/types";

function NotesOverview({
  notes,
  onSelect,
  onNewNote,
}: {
  notes: Note[];
  onSelect: (note: Note) => void;
  onNewNote: () => void;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const todayCount = notes.filter(
    (n) => new Date(n.createdAt) >= todayStart,
  ).length;
  const weekCount = notes.filter(
    (n) => new Date(n.createdAt) >= weekStart,
  ).length;
  const recentNotes = notes.slice(0, 6);

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 paper-texture">
        <div className="relative">
          <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full" />
          <div className="relative w-32 h-32 bg-zinc-100 dark:bg-zinc-800 rounded-[3rem] flex items-center justify-center shadow-2xl backdrop-blur-sm border border-apple-border">
            <span className="text-6xl drop-shadow-md">📒</span>
          </div>
        </div>
        <div className="space-y-3 max-w-sm">
          <h3 className="text-3xl font-bold tracking-tight italic">
            No Notes Yet
          </h3>
          <p className="text-zinc-500 font-medium">
            Create your first note to get started.
          </p>
          <button
            onClick={onNewNote}
            className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-accent text-white rounded-2xl font-semibold shadow-md hover:opacity-90 active:scale-95 transition-all"
          >
            <PlusIcon size={16} strokeWidth={2.5} />
            New Note
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto paper-texture">
      {/* Header */}
      <div className="px-10 pt-12 pb-6">
        <div className="flex items-end justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Overview
          </p>
          <h2 className="text-3xl font-bold tracking-tight">Your Notes</h2>
          <button
            onClick={onNewNote}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-2xl text-sm font-semibold shadow hover:opacity-90 active:scale-95 transition-all"
          >
            <PlusIcon size={15} strokeWidth={2.5} />
            New Note
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-10 pb-8 grid grid-cols-3 gap-4">
        <div className="bg-white/70 dark:bg-white/5 border border-apple-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <FileTextIcon size={18} className="text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold">{notes.length}</p>
            <p className="text-xs text-gray-400 font-medium">Total Notes</p>
          </div>
        </div>
        <div className="bg-white/70 dark:bg-white/5 border border-apple-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
            <CalendarIcon size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{weekCount}</p>
            <p className="text-xs text-gray-400 font-medium">This Week</p>
          </div>
        </div>
        <div className="bg-white/70 dark:bg-white/5 border border-apple-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <ClockIcon size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{todayCount}</p>
            <p className="text-xs text-gray-400 font-medium">Today</p>
          </div>
        </div>
      </div>

      {/* Recent notes grid */}
      <div className="px-10 pb-12">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Recent
        </p>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {recentNotes.map((note) => {
            const snippet = stripHtml(note.content);
            const imageUrl = extractFirstImage(note.content);
            return (
              <button
                key={note.id}
                onClick={() => onSelect(note)}
                className="group text-left bg-white/70 dark:bg-white/5 border border-apple-border rounded-2xl overflow-hidden hover:shadow-md hover:border-accent/30 active:scale-[0.98] transition-all duration-150"
              >
                {imageUrl && (
                  <div
                    className="w-full h-28 bg-cover bg-center border-b border-apple-border/50"
                    style={{ backgroundImage: `url(${imageUrl})` }}
                  />
                )}
                <div className="p-4 space-y-1">
                  <h3 className="font-bold text-[14px] truncate text-gray-900 dark:text-gray-100">
                    {note.title || "Untitled Note"}
                  </h3>
                  <p className="text-[12px] text-gray-400 line-clamp-2 leading-relaxed">
                    {snippet || "No additional text"}
                  </p>
                  <p className="text-[11px] text-gray-300 dark:text-gray-600 pt-1">
                    {formatRelativeTime(note.createdAt)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allNotes = [], isLoading, isError } = useNotes();
  const { data: searchResults, isLoading: isSearching } =
    useSearchNotes(searchQuery);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !token) {
    return null;
  }

  const notes = searchQuery.trim() ? searchResults : allNotes;
  const isNotesLoading = searchQuery.trim() ? isSearching : isLoading;

  return (
    <main className="flex h-screen w-full bg-background overflow-hidden relative">
      <div className="hidden md:block">
        <Sidebar
          onNewNote={() => router.push("/notes/new")}
          onLogout={logout}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
      <NoteList
        notes={notes}
        isLoading={isNotesLoading}
        isError={isError}
        selectedId={undefined}
        onSelect={(note) => router.push(`/notes/${note.id}`)}
        searchQuery={searchQuery}
        onClearSearch={() => setSearchQuery("")}
      />
      <NotesOverview
        notes={allNotes}
        onSelect={(note) => router.push(`/notes/${note.id}`)}
        onNewNote={() => router.push("/notes/new")}
      />
    </main>
  );
}

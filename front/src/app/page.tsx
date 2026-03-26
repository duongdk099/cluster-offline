"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { NoteList } from "@/components/NoteList";
import { useNotes, useSearchNotes } from "@/hooks/useNotes";
import { stripHtml, extractFirstImage, formatRelativeTime } from "@/lib/utils";
import {
  PlusIcon,
  FileTextIcon,
  CalendarIcon,
  ClockIcon,
  LogOutIcon,
  SearchIcon,
  LayoutGridIcon,
  ListIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 text-center space-y-6 md:space-y-8 paper-texture">
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
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto paper-texture">
      {/* Header */}
      <div className="px-4 md:px-10 pt-5 md:pt-12 pb-4 md:pb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Overview
            </p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your Notes</h2>
          </div>
          <button
            onClick={onNewNote}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-2xl text-sm font-semibold shadow hover:opacity-90 active:scale-95 transition-all"
          >
            <PlusIcon size={15} strokeWidth={2.5} />
            New Note
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 md:px-10 pb-6 md:pb-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 md:gap-4">
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
      <div className="px-4 md:px-10 pb-24 md:pb-12">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Recent
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
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
                    {formatRelativeTime(note.updatedAt ?? note.createdAt)}
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

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "overview">("list");
  const [showLeftPanels, setShowLeftPanels] = useState(true);
  const selectedTag = searchParams.get('tag') || '';
  const selectedFolder = searchParams.get('folder') || '';
  const { data: allNotes = [], isLoading, isError } = useNotes({
    tag: selectedTag || undefined,
    folder: selectedFolder || undefined,
  });
  const { data: searchResults, isLoading: isSearching } =
    useSearchNotes(searchQuery, {
      tag: selectedTag || undefined,
      folder: selectedFolder || undefined,
    });

  const updateFilters = (nextTag: string, nextFolder: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextTag) {
      params.set('tag', nextTag);
    } else {
      params.delete('tag');
    }

    if (nextFolder) {
      params.set('folder', nextFolder);
    } else {
      params.delete('folder');
    }

    const query = params.toString();
    router.push(query ? `/?${query}` : '/');
  };

  if (!token) {
    return null;
  }

  const notes = searchQuery.trim() ? searchResults : allNotes;
  const isNotesLoading = searchQuery.trim() ? isSearching : isLoading;

  return (
    <main className="app-shell">
      <div className="app-frame flex flex-col w-full overflow-hidden relative">
        <div className="desktop-window-titlebar hidden md:flex items-center px-4 gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/90" />
          <span className="ml-3 text-[11px] text-gray-500 font-semibold tracking-wide">
            Notes Workspace
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

        <div className="mobile-topbar md:hidden space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="mobile-topbar-title">Workspace</p>
              <h1 className="text-lg font-bold tracking-tight leading-none mt-1">Notes</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/notes/new")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-xl text-sm font-semibold shadow-sm"
              >
                <PlusIcon size={15} />
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
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search notes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-apple-border/40 rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="w-full flex flex-col md:flex-row overflow-hidden flex-1">
          <div className={`hidden md:block app-panel transition-all duration-300 overflow-hidden ${
            showLeftPanels ? "md:block" : "md:w-0 md:hidden"
          }`}>
            <Sidebar
              onNewNote={() => router.push("/notes/new")}
              onLogout={logout}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedTag={selectedTag}
              selectedFolder={selectedFolder}
              onSelectTag={(tag) => updateFilters(tag, '')}
              onSelectFolder={(folder) => updateFilters('', folder)}
            />
          </div>

          <div className={`hidden md:block app-section transition-all duration-300 overflow-hidden ${
            showLeftPanels ? "md:block" : "md:w-0 md:hidden"
          }`}>
            <NoteList
              notes={notes}
              isLoading={isNotesLoading}
              isError={isError}
              selectedId={undefined}
              onSelect={(note) => router.push(`/notes/${note.id}`)}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery("")}
            />
          </div>

          <div className="hidden md:flex flex-1 app-section">
            <NotesOverview
              notes={allNotes}
              onSelect={(note) => router.push(`/notes/${note.id}`)}
              onNewNote={() => router.push("/notes/new")}
            />
          </div>

          <div className="md:hidden flex-1 overflow-hidden pb-24 bg-white/70 dark:bg-transparent">
            {mobileView === "list" ? (
              <NoteList
                notes={notes}
                isLoading={isNotesLoading}
                isError={isError}
                selectedId={undefined}
                onSelect={(note) => router.push(`/notes/${note.id}`)}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery("")}
              />
            ) : (
              <NotesOverview
                notes={allNotes}
                onSelect={(note) => router.push(`/notes/${note.id}`)}
                onNewNote={() => router.push("/notes/new")}
              />
            )}
          </div>
        </div>

        <nav className="mobile-tabbar md:hidden px-2 py-2 grid grid-cols-3 gap-1">
          <button
            onClick={() => setMobileView("list")}
            className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              mobileView === "list" ? "bg-black text-white dark:bg-white dark:text-black" : "text-gray-500"
            }`}
          >
            <ListIcon size={15} />
            List
          </button>
          <button
            onClick={() => router.push("/notes/new")}
            className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-accent text-white"
          >
            <PlusIcon size={15} />
            New
          </button>
          <button
            onClick={() => setMobileView("overview")}
            className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              mobileView === "overview" ? "bg-black text-white dark:bg-white dark:text-black" : "text-gray-500"
            }`}
          >
            <LayoutGridIcon size={15} />
            Home
          </button>
        </nav>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

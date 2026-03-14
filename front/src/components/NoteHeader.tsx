interface NoteHeaderProps {
    logout: () => void;
}

export function NoteHeader({ logout }: NoteHeaderProps) {
    return (
        <div className="flex justify-between items-center">
            <div className="space-y-4">
                <h1 className="text-5xl font-semibold tracking-tight text-gray-900">
                    NotesAides
                </h1>
                <p className="text-xl text-gray-500 max-w-2xl font-light">
                    Capture your thoughts effortlessly with a premium, Apple-inspired experience built on modern edge tools.
                </p>
            </div>
            <button
                onClick={logout}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-full hover:bg-gray-100 transition-colors text-sm font-medium"
            >
                Log Out
            </button>
        </div>
    );
}

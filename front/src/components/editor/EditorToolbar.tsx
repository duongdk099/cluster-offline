
import React from 'react';
import { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    List,
    CheckSquare,
    Image as ImageIcon,
    Table as TableIcon
} from 'lucide-react';

interface ToolbarButtonProps {
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    title?: string;
}

export function ToolbarButton({ icon, onClick, active = false, title }: ToolbarButtonProps) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`w-[38px] h-[32px] flex items-center justify-center rounded-lg transition-all duration-200 
                ${active ? 'bg-white shadow-sm border-apple-border text-accent dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            style={{ border: '1px solid currentColor', borderColor: active ? 'var(--border)' : 'transparent' }}
        >
            {icon}
        </button>
    );
}

interface EditorToolbarProps {
    editor: Editor | null;
    onAddImage: () => void;
}

export function EditorToolbar({ editor, onAddImage }: EditorToolbarProps) {
    if (!editor) return null;

    const handleTableAction = () => {
        if (editor.isActive('table')) {
            editor.chain().focus().addRowAfter().run();
        } else {
            editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
        }
    };

    return (
        <div className="flex items-center gap-1.5 p-1">
            <div className="toolbar-group">
                <ToolbarButton
                    icon={<CheckSquare size={17} strokeWidth={2.5} />}
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    active={editor.isActive('taskList')}
                    title="Checklist"
                />
                <ToolbarButton
                    icon={<List size={17} strokeWidth={2.5} />}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    active={editor.isActive('bulletList')}
                    title="Bullet List"
                />
                <ToolbarButton
                    icon={<TableIcon size={17} strokeWidth={2.5} />}
                    onClick={handleTableAction}
                    active={editor.isActive('table')}
                    title={editor.isActive('table') ? "Add Row" : "Table"}
                />
            </div>

            <div className="w-px h-5 mx-1.5 bg-apple-border/50" />

            <div className="toolbar-group">
                <ToolbarButton
                    icon={<Bold size={17} strokeWidth={2.5} />}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    active={editor.isActive('bold')}
                    title="Bold"
                />
                <ToolbarButton
                    icon={<Italic size={17} strokeWidth={2.5} />}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    active={editor.isActive('italic')}
                    title="Italic"
                />
            </div>

            <div className="w-px h-5 mx-1.5 bg-apple-border/50" />

            <ToolbarButton
                icon={<ImageIcon size={18} strokeWidth={2} />}
                onClick={onAddImage}
                title="Add Image"
            />
        </div>
    );
}

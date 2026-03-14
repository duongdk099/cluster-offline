
import React from 'react';
import { SaveStatus } from '../../hooks/useNoteEditor';
import { formatRelativeTime } from '../../lib/utils';

interface StatusBadgeProps {
    status: SaveStatus;
    createdAt?: string;
}

export function StatusBadge({ status, createdAt }: StatusBadgeProps) {
    if (status === 'idle') {
        return (
            <div className="status-badge opacity-60">
                <span>{createdAt ? formatRelativeTime(createdAt) : 'Draft'}</span>
            </div>
        );
    }

    return (
        <div className="status-badge">
            {(status === 'saving' || status === 'optimizing') && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            )}
            <span className="text-accent/80 transition-colors duration-300">
                {status === 'optimizing' ? 'Optimizing (WASM)' :
                    status === 'cropping' ? 'Cropping Image (WASM)' :
                        status === 'saving' ? 'Saving' :
                            status === 'saved' ? 'Saved' : ''}
            </span>
        </div>
    );
}

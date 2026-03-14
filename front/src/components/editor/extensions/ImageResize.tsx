
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useState, useRef, useEffect } from 'react';

export default function ImageResize(props: NodeViewProps) {
    const { node, updateAttributes, selected } = props;
    const [isResizing, setIsResizing] = useState(false);
    const [aspectRatio, setAspectRatio] = useState(1);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (imgRef.current) {
            const { naturalWidth, naturalHeight } = imgRef.current;
            if (naturalWidth && naturalHeight) {
                setAspectRatio(naturalWidth / naturalHeight);
            }
        }
    }, [node.attrs.src]);

    const handleResize = (e: MouseEvent) => {
        if (!isResizing || !imgRef.current) return;

        const rect = imgRef.current.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;

        // Minimum width 50px
        if (newWidth < 50) return;

        updateAttributes({
            width: newWidth,
            height: newWidth / aspectRatio,
        });
    };

    const stopResize = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    };

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
    };

    return (
        <NodeViewWrapper className="relative inline-block group">
            <div className={`relative inline-block transition-all duration-200 ${selected ? 'ring-2 ring-accent ring-offset-2 rounded-2xl' : ''}`}>
                <img
                    ref={imgRef}
                    src={node.attrs.src}
                    style={{
                        width: node.attrs.width || 'auto',
                        height: node.attrs.height || 'auto',
                        maxWidth: '100%',
                    }}
                    className="rounded-2xl border border-apple-border block shadow-sm"
                    onLoad={() => {
                        if (imgRef.current) {
                            setAspectRatio(imgRef.current.naturalWidth / imgRef.current.naturalHeight);
                        }
                    }}
                />

                {selected && (
                    <div
                        className="absolute bottom-[-6px] right-[-6px] w-4 h-4 bg-accent border-2 border-white rounded-full cursor-nwse-resize z-30 shadow-md transition-transform hover:scale-125"
                        onMouseDown={startResize}
                    />
                )}
            </div>
        </NodeViewWrapper>
    );
}

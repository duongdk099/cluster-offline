
import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X } from 'lucide-react';

interface ImageCropModalProps {
    imageUrl: string;
    onCrop: (pixelCrop: PixelCrop) => void;
    onCancel: () => void;
}

export function ImageCropModal({ imageUrl, onCrop, onCancel }: ImageCropModalProps) {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [imgSize, setImgSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height, naturalWidth, naturalHeight } = e.currentTarget;
        setImgSize({ width, height, naturalWidth, naturalHeight });

        const initialCrop = centerCrop(
            makeAspectCrop(
                { unit: '%', width: 90 },
                1,
                width,
                height
            ),
            width,
            height
        );
        setCrop(initialCrop);
    }

    const handleApply = () => {
        if (!completedCrop || !imgSize.naturalWidth) return;

        // SCALE COORDINATES TO NATURAL IMAGE SIZE (What WASM expects)
        const scaleX = imgSize.naturalWidth / imgSize.width;
        const scaleY = imgSize.naturalHeight / imgSize.height;

        const naturalPixelCrop: PixelCrop = {
            x: Math.round(completedCrop.x * scaleX),
            y: Math.round(completedCrop.y * scaleY),
            width: Math.round(completedCrop.width * scaleX),
            height: Math.round(completedCrop.height * scaleY),
            unit: 'px'
        };

        onCrop(naturalPixelCrop);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full flex flex-col max-h-[90vh]">
                <div className="p-6 border-bottom flex items-center justify-between border-b border-apple-border">
                    <h3 className="text-xl font-bold">Crop Image</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <button
                            onClick={handleApply}
                            className="bg-accent text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all"
                        >
                            <Check size={18} /> Apply Crop
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                    >
                        <img
                            src={imageUrl}
                            onLoad={onImageLoad}
                            className="max-h-[60vh] object-contain"
                            crossOrigin="anonymous"
                        />
                    </ReactCrop>
                </div>
            </div>
        </div>
    );
}

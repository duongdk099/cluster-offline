/**
 * Image Optimizer Service
 * Uses pure Rust WASM for image processing (decode, scale, crop, rotate)
 * and Browser Canvas for high-quality hardware-accelerated WebP encoding.
 */

// Turbopack (Next.js 16 default) initializes WASM modules automatically on import,
// so no explicit `init()` call is needed. Named exports are used directly.
import { resize_image as wasm_resize_image, crop_image as wasm_crop_image, rotate_image as wasm_rotate_image, ProcessedImage } from 'image-wasm';

// No-op: Turbopack handles WASM initialization natively (like webpack asyncWebAssembly).
async function loadWasm() {
    // intentionally empty
}

/**
 * Converts pure raw RGBA pixels from WASM into a WebP Blob using hardware HTML5 Canvas
 */
function pixelsToWebpFile(pixels: Uint8Array, width: number, height: number, originalName: string, quality: number = 0.95, filenamePrefix: string = ''): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    // Uint8Array returned by wasm contains RGBA pixels
    // Wrap it in a Uint8ClampedArray to make an ImageData
    const clamped = new Uint8ClampedArray(pixels);
    const imageData = new ImageData(clamped, width, height);

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const baseName = originalName.replace(/\.[^/.]+$/, "");
                    const finalName = filenamePrefix ? `${filenamePrefix}-${baseName}.webp` : `${baseName}.webp`;
                    const optimizedFile = new File([blob], finalName, {
                        type: 'image/webp',
                        lastModified: Date.now(),
                    });
                    resolve(optimizedFile);
                } else {
                    reject(new Error('Canvas toBlob failed'));
                }
            },
            'image/webp',
            quality
        );
    });
}

export async function optimizeImage(file: File): Promise<File> {
    await loadWasm();

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    try {
        const MAX_WIDTH = 1920;

        // 1. Rust decodes JPEG/PNG, resizes if needed via Lanczos3, and returns Raw RGBA pixels
        const processedImage: ProcessedImage = wasm_resize_image(bytes, MAX_WIDTH);

        const width = processedImage.width;
        const height = processedImage.height;
        const pixels = processedImage.get_pixels();

        // Must free Rust memory properly
        processedImage.free();

        // 2. JS packages those pixels natively to a high quality 95% WebP
        return pixelsToWebpFile(pixels, width, height, file.name, 0.95);

    } catch (error) {
        console.error('[Optimizer] WASM Processing failed, falling back to original file:', error);
        return file;
    }
}

/**
 * Crop an image using WASM
 */
export async function cropImage(file: File, x: number, y: number, width: number, height: number): Promise<File> {
    await loadWasm();

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    try {
        // 1. Rust crops the image natively and returns raw RGBA pixels
        const processedImage: ProcessedImage = wasm_crop_image(bytes, x, y, width, height);

        const finalWidth = processedImage.width;
        const finalHeight = processedImage.height;
        const pixels = processedImage.get_pixels();

        processedImage.free();

        // 2. JS packages it into a final WebP (95% quality to minimize generational loss)
        return pixelsToWebpFile(pixels, finalWidth, finalHeight, file.name, 0.95, 'cropped');

    } catch (error) {
        console.error('[Optimizer] WASM Crop failed:', error);
        return file;
    }
}

/**
 * Rotate an image using WASM
 */
export async function rotateImage(file: File, degrees: number): Promise<File> {
    await loadWasm();

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    try {
        // 1. Rust rotates the image natively and returns raw RGBA pixels
        const processedImage: ProcessedImage = wasm_rotate_image(bytes, degrees);

        const finalWidth = processedImage.width;
        const finalHeight = processedImage.height;
        const pixels = processedImage.get_pixels();

        processedImage.free();

        // 2. JS packages it into a final WebP (95% quality to minimize generational loss)
        return pixelsToWebpFile(pixels, finalWidth, finalHeight, file.name, 0.95, `rotated-${degrees}`);

    } catch (error) {
        console.error('[Optimizer] WASM Rotate failed:', error);
        return file;
    }
}

const TARGET_SIZE_KB = 50;
const MAX_SIZE_KB = 95; // Hard limit (bucket max is 100KB, leave margin)
const MAX_DIMENSION = 1200;
const MIN_DIMENSION = 400;
const INITIAL_QUALITY = 0.8;
const MIN_QUALITY = 0.3; // Don't go below 30% quality - reduce dimensions instead
const QUALITY_STEP = 0.1;
const DIMENSION_STEP = 200;

export interface CompressionResult {
    blob: Blob;
    dataUrl: string;
    originalSize: number;
    compressedSize: number;
}

/**
 * Compresses an image file to approximately 50KB, with hard limit of 95KB.
 * Uses Canvas API for resizing and JPEG compression.
 * Will progressively reduce dimensions if quality reduction alone isn't enough.
 */
export async function compressImage(file: File): Promise<CompressionResult> {
    const originalSize = file.size;

    // Load image
    const img = await loadImage(file);

    // Clean up object URL after we're done
    const cleanup = () => URL.revokeObjectURL(img.src);

    let maxDim = MAX_DIMENSION;
    let blob: Blob;

    // Try progressively smaller dimensions until we're under the hard limit
    while (maxDim >= MIN_DIMENSION) {
        // Calculate dimensions for current max
        const { width, height } = calculateDimensions(
            img.width,
            img.height,
            maxDim,
        );

        // Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try to compress to target size with quality reduction
        let quality = INITIAL_QUALITY;
        blob = await canvasToBlob(canvas, 'image/jpeg', quality);

        while (blob.size > TARGET_SIZE_KB * 1024 && quality > MIN_QUALITY) {
            quality -= QUALITY_STEP;
            blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        }

        // If we're under hard limit, we're done
        if (blob.size <= MAX_SIZE_KB * 1024) {
            cleanup();
            const dataUrl = await blobToDataUrl(blob);
            return {
                blob,
                dataUrl,
                originalSize,
                compressedSize: blob.size,
            };
        }

        // Try smaller dimensions
        maxDim -= DIMENSION_STEP;
    }

    cleanup();
    throw new Error(
        `Unable to compress image below ${MAX_SIZE_KB}KB limit. Please try a smaller image.`,
    );
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

function calculateDimensions(
    width: number,
    height: number,
    maxDim: number,
): { width: number; height: number } {
    if (width <= maxDim && height <= maxDim) {
        return { width, height };
    }

    const ratio = Math.min(maxDim / width, maxDim / height);
    return {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
    };
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob'));
                }
            },
            type,
            quality,
        );
    });
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
    });
}

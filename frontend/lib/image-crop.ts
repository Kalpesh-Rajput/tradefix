export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_OUTPUT_PX = 512;

export type CropOffset = { x: number; y: number };

/** Returns an error message, or null when the file can be used as an avatar. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Unsupported format. Use PNG, JPG or WEBP.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return `Image is too large. Maximum size is ${AVATAR_MAX_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

/** Scale at which the image exactly covers a square viewport. */
export function coverScale(imageW: number, imageH: number, viewport: number): number {
  return Math.max(viewport / imageW, viewport / imageH);
}

/** Keeps the image covering the whole viewport after panning or zooming. */
export function clampOffset(
  offset: CropOffset,
  imageW: number,
  imageH: number,
  viewport: number,
  scale: number
): CropOffset {
  const maxX = Math.max(0, (imageW * scale - viewport) / 2);
  const maxY = Math.max(0, (imageH * scale - viewport) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

/** Source rectangle (in image pixels) visible inside the square viewport. */
export function sourceRect(
  offset: CropOffset,
  imageW: number,
  imageH: number,
  viewport: number,
  scale: number
): { sx: number; sy: number; size: number } {
  const left = viewport / 2 + offset.x - (imageW * scale) / 2;
  const top = viewport / 2 + offset.y - (imageH * scale) / 2;
  return { sx: -left / scale, sy: -top / scale, size: viewport / scale };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Renders the cropped square to a WebP (JPEG fallback) blob sized for avatars. */
export async function renderCrop(
  image: CanvasImageSource & { naturalWidth: number; naturalHeight: number },
  offset: CropOffset,
  viewport: number,
  scale: number
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_PX;
  canvas.height = AVATAR_OUTPUT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser");
  ctx.imageSmoothingQuality = "high";
  const { sx, sy, size } = sourceRect(offset, image.naturalWidth, image.naturalHeight, viewport, scale);
  ctx.drawImage(image, sx, sy, size, size, 0, 0, AVATAR_OUTPUT_PX, AVATAR_OUTPUT_PX);

  const webp = await canvasToBlob(canvas, "image/webp", 0.9);
  if (webp && webp.type === "image/webp") return new File([webp], "avatar.webp", { type: "image/webp" });
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.9);
  if (!jpeg) throw new Error("Could not process the image");
  return new File([jpeg], "avatar.jpg", { type: "image/jpeg" });
}

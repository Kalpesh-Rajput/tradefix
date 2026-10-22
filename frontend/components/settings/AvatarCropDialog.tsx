"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { clampOffset, coverScale, renderCrop, type CropOffset } from "@/lib/image-crop";

const VIEWPORT = 256;
const MAX_ZOOM = 3;
const KEY_STEP = 12;

/** Square crop with a circular mask. Pan by dragging or arrow keys, zoom with the slider. */
export function AvatarCropDialog({
  file,
  uploading,
  progress,
  error,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  uploading: boolean;
  progress: number | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; origin: CropOffset } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      setNatural(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setNatural(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLocalError(null);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const scale = natural ? coverScale(natural.w, natural.h, VIEWPORT) * zoom : 1;

  const move = useCallback(
    (next: CropOffset) => {
      if (!natural) return;
      setOffset(clampOffset(next, natural.w, natural.h, VIEWPORT, scale));
    },
    [natural, scale]
  );

  function onZoom(value: number) {
    setZoom(value);
    if (!natural) return;
    setOffset((current) =>
      clampOffset(current, natural.w, natural.h, VIEWPORT, coverScale(natural.w, natural.h, VIEWPORT) * value)
    );
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, origin: offset };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    move({ x: drag.origin.x + e.clientX - drag.x, y: drag.origin.y + e.clientY - drag.y });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, CropOffset> = {
      ArrowLeft: { x: KEY_STEP, y: 0 },
      ArrowRight: { x: -KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP },
      ArrowDown: { x: 0, y: -KEY_STEP },
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    move({ x: offset.x + d.x, y: offset.y + d.y });
  }

  async function confirm() {
    const image = imageRef.current;
    if (!image || !natural || processing) return;
    setProcessing(true);
    setLocalError(null);
    try {
      onConfirm(await renderCrop(image, offset, VIEWPORT, scale));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not process the image");
    } finally {
      setProcessing(false);
    }
  }

  const busy = uploading || processing;
  const shownError = error || localError;

  return (
    <Dialog
      open={Boolean(file)}
      onClose={onCancel}
      dismissible={!busy}
      size="sm"
      title="Adjust your photo"
      description="Drag to reposition and use the slider to zoom. The circle is what others will see."
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={confirm} loading={busy} disabled={!natural}>
            {uploading && progress !== null ? `Uploading ${progress}%` : "Save photo"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 pt-1">
        <div
          role="group"
          tabIndex={0}
          aria-label="Photo crop area. Use arrow keys to reposition."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (dragRef.current = null)}
          onPointerCancel={() => (dragRef.current = null)}
          onKeyDown={onKeyDown}
          className="relative cursor-grab touch-none overflow-hidden rounded-lg bg-black outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] active:cursor-grabbing"
          style={{ width: VIEWPORT, height: VIEWPORT, maxWidth: "100%" }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={url}
              alt="Selected photo preview"
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setLocalError("This image could not be read. Try another file.")}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: natural ? natural.w * scale : undefined,
                height: natural ? natural.h * scale : undefined,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          ) : null}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-white/70 shadow-[0_0_0_999px_rgb(0_0_0/0.55)]"
          />
        </div>

        <label className="flex w-full max-w-[256px] items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          Zoom
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={busy || !natural}
            onChange={(e) => onZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1 flex-1 cursor-pointer accent-[var(--color-primary)]"
          />
        </label>

        <p role="alert" aria-live="polite" className="min-h-4 text-center text-xs text-destructive">
          {shownError}
        </p>
      </div>
    </Dialog>
  );
}

"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { mediaUrl } from "@/lib/media";

export function ScreenshotLightbox({
  urls,
  index,
  onClose,
  onIndexChange,
  alt = "Screenshot",
}: {
  urls: string[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  alt?: string;
}) {
  const open = index != null && urls.length > 0;
  const safeIndex = open ? Math.min(Math.max(index, 0), urls.length - 1) : 0;
  const src = open ? mediaUrl(urls[safeIndex]) ?? urls[safeIndex] : null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndexChange((safeIndex + 1) % urls.length);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange((safeIndex - 1 + urls.length) % urls.length);
      }
    }
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, onIndexChange, safeIndex, urls.length]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close screenshot" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={alt}
        className="relative z-10 flex max-h-[92vh] w-full max-w-[1100px] flex-col"
      >
        <div className="mb-3 flex items-center justify-between gap-3 text-white">
          <p className="text-[12px] font-medium tabular-nums text-white/80">
            {safeIndex + 1} / {urls.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {urls.length > 1 ? (
            <button
              type="button"
              onClick={() => onIndexChange((safeIndex - 1 + urls.length) % urls.length)}
              className="absolute left-0 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src || undefined}
            alt={alt}
            className="max-h-[82vh] w-auto max-w-full rounded-lg border border-white/10 object-contain shadow-[0_18px_56px_rgba(0,0,0,0.45)]"
          />
          {urls.length > 1 ? (
            <button
              type="button"
              onClick={() => onIndexChange((safeIndex + 1) % urls.length)}
              className="absolute right-0 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              aria-label="Next screenshot"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

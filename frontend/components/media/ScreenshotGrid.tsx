"use client";

import clsx from "clsx";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ScreenshotLightbox } from "@/components/media/ScreenshotLightbox";
import { mediaUrl } from "@/lib/media";

export type PendingShot = {
  id: string;
  src: string;
  label?: string;
};

export function ScreenshotGrid({
  urls,
  pending = [],
  onDelete,
  onDeletePending,
  onAdd,
  uploading = false,
  canAdd = true,
  max = 5,
  tone = "light",
  emptyHint = "Drop charts here or click to browse",
  addLabel = "Add",
  compact = false,
}: {
  urls: string[];
  pending?: PendingShot[];
  onDelete?: (url: string) => void;
  onDeletePending?: (id: string) => void;
  onAdd?: () => void;
  uploading?: boolean;
  canAdd?: boolean;
  max?: number;
  tone?: "light" | "dark";
  emptyHint?: string;
  addLabel?: string;
  compact?: boolean;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const viewUrls = useMemo(() => [...pending.map((p) => p.src), ...urls], [pending, urls]);
  const total = urls.length + pending.length;
  const room = total < max;
  const dark = tone === "dark";

  const tile = dark
    ? "group relative overflow-hidden rounded-lg border border-white/10 bg-black/20"
    : "group relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]";
  const delBtn = dark
    ? "absolute right-1.5 top-1.5 rounded bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
    : "absolute right-1.5 top-1.5 rounded bg-[var(--color-text-primary)]/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100";
  const empty = dark
    ? `flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-zinc-500 transition hover:border-white/30 hover:text-zinc-300 disabled:opacity-40 ${compact ? "py-4" : "py-10"}`
    : `flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-text-tertiary)] transition hover:border-[var(--color-border-light)] hover:text-[var(--color-text-secondary)] disabled:opacity-40 ${compact ? "py-3" : "py-8"}`;

  return (
    <div>
      <div className={clsx("flex items-center justify-between gap-2", compact ? "mb-1.5" : "mb-3")}>
        <div>
          <h3
            className={clsx(
              "text-[13px] font-semibold",
              dark ? "text-white" : "text-[var(--color-text-primary)]"
            )}
          >
            Screenshots
          </h3>
          <p className={clsx("mt-0.5 text-[11px]", dark ? "text-zinc-500" : "text-[var(--color-text-tertiary)]")}>
            {total}/{max} · PNG, JPG, WEBP · click to view
          </p>
        </div>
        {onAdd ? (
          <button
            type="button"
            disabled={!canAdd || !room || uploading}
            onClick={onAdd}
            className={clsx(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium disabled:opacity-50",
              dark
                ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
            )}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : addLabel}
          </button>
        ) : null}
      </div>

      {total === 0 ? (
        <button type="button" onClick={onAdd} disabled={!canAdd || uploading} className={empty}>
          <ImagePlus className="h-6 w-6" />
          <span className="text-[12px]">{emptyHint}</span>
        </button>
      ) : (
        <div className={clsx("grid gap-2", compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-3")}>
          {pending.map((shot, i) => (
            <div key={shot.id} className={tile}>
              <button type="button" className="block w-full" onClick={() => setIndex(i)} aria-label="View screenshot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.src}
                  alt={shot.label || "Pending screenshot"}
                  className={clsx("w-full object-cover", compact ? "h-16" : "h-28 sm:h-32")}
                />
              </button>
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                Pending
              </span>
              {onDeletePending ? (
                <button
                  type="button"
                  onClick={() => onDeletePending(shot.id)}
                  className={delBtn}
                  aria-label="Remove screenshot"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
          {urls.map((url, i) => {
            const src = mediaUrl(url) ?? url;
            return (
              <div key={url} className={tile}>
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => setIndex(pending.length + i)}
                  aria-label="View screenshot"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="Screenshot" className={clsx("w-full object-cover", compact ? "h-16" : "h-28 sm:h-32")} />
                </button>
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(url)}
                    className={delBtn}
                    aria-label="Delete screenshot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <ScreenshotLightbox urls={viewUrls} index={index} onClose={() => setIndex(null)} onIndexChange={setIndex} />
    </div>
  );
}

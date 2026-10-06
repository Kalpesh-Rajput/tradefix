"use client";

import { Image, Trash2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";

export type NewShot = { id: string; kind: "new"; file: File; preview: string };
export type SavedShot = { id: string; kind: "saved"; url: string; preview: string };
export type Shot = NewShot | SavedShot;

export function ScreenshotUploader({
  files,
  onChange,
  onDeleteSaved,
  max = 5,
}: {
  files: Shot[];
  onChange: (files: Shot[]) => void;
  onDeleteSaved?: (url: string) => void;
  max?: number;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const room = Math.max(0, max - files.length);
      const next: NewShot[] = accepted.slice(0, room).map((file) => ({
        id: `${file.name}-${file.size}-${Math.random()}`,
        kind: "new",
        file,
        preview: URL.createObjectURL(file),
      }));
      if (!next.length) return;
      onChange([...files, ...next]);
    },
    [files, onChange, max]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/png": [], "image/jpeg": [], "image/webp": [] },
    multiple: true,
    disabled: files.length >= max,
  });

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length) onDrop(imgs);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onDrop]);

  function remove(shot: Shot) {
    if (shot.kind === "saved") {
      onDeleteSaved?.(shot.url);
      return;
    }
    URL.revokeObjectURL(shot.preview);
    onChange(files.filter((file) => file.id !== shot.id));
  }

  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
        Chart Screenshots
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          {...getRootProps()}
          disabled={files.length >= max}
          className="flex h-12 items-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-3 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:border-primary/40 hover:bg-[var(--color-primary-very-light)] hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <input {...getInputProps()} />
          <Image className="h-3.5 w-3.5" />
          Add chart screenshot
        </button>
      </div>

      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((shot) => (
            <div key={shot.id} className="relative overflow-hidden rounded-[10px] border border-[var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.preview}
                alt={shot.kind === "new" ? shot.file.name : "Chart screenshot"}
                className="h-24 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(shot)}
                className="absolute right-1 top-1 rounded-md bg-[var(--color-surface)]/90 p-1 text-[var(--color-text-secondary)] shadow-sm"
                aria-label="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

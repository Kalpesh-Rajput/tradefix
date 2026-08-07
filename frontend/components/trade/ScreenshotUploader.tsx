"use client";

import { Image, Trash2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";

export type Shot = { id: string; file: File; preview: string };

export function ScreenshotUploader({
  files,
  onChange,
  max = 5,
}: {
  files: Shot[];
  onChange: (files: Shot[]) => void;
  max?: number;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const room = Math.max(0, max - files.length);
      const next = accepted.slice(0, room).map((file) => ({
        id: `${file.name}-${file.size}-${Math.random()}`,
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

  function remove(id: string) {
    const target = files.find((f) => f.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    onChange(files.filter((f) => f.id !== id));
  }

  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">Chart Screenshots</label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          {...getRootProps()}
          className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-white/40 hover:text-white"
        >
          <input {...getInputProps()} />
          <Image className="h-3.5 w-3.5" />
          Add chart screenshot
        </button>
      </div>

      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {files.map((f) => (
            <div key={f.id} className="group relative overflow-hidden rounded-lg border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.preview} alt={f.file.name} className="h-20 w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(f.id)}
                className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
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

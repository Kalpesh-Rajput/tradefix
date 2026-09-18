"use client";

export function TemplatePreview({
  icon,
  title,
}: {
  icon?: string;
  title: string;
  seed?: string;
}) {
  return (
    <div
      className="relative flex aspect-video w-full items-end justify-between bg-[var(--color-surface-secondary)] px-3 py-3"
      aria-hidden
    >
      <span className="text-[22px] leading-none">{icon || "📘"}</span>
      <span className="max-w-[70%] truncate text-[11px] font-medium text-[var(--color-text-secondary)]">
        {title}
      </span>
    </div>
  );
}

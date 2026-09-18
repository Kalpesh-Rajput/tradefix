"use client";

import clsx from "clsx";
import {
  AlignLeft,
  Bold,
  Eraser,
  Highlighter,
  Italic,
  Link2,
  Maximize2,
  Mic,
  Minus,
  Plus,
  Strikethrough,
  Underline,
} from "lucide-react";

const BLOCKS = [
  { id: "P", label: "P" },
  { id: "H2", label: "H2" },
  { id: "H3", label: "H3" },
] as const;

const FONTS = ["Arial", "Georgia", "Times New Roman", "Verdana"] as const;

export function EditorToolbar({
  block,
  font,
  fontSize,
  onBlock,
  onFont,
  onFontSize,
  onCommand,
  onLink,
  onColor,
  onHighlight,
  onMic,
  onFullscreen,
  micOn,
}: {
  block: string;
  font: string;
  fontSize: number;
  onBlock: (value: string) => void;
  onFont: (value: string) => void;
  onFontSize: (value: number) => void;
  onCommand: (command: string) => void;
  onLink: () => void;
  onColor: (color: string) => void;
  onHighlight: (color: string) => void;
  onMic: () => void;
  onFullscreen: () => void;
  micOn?: boolean;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden border-y border-[var(--color-border)] px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <IconBtn label="Fullscreen" onClick={onFullscreen}>
        <Maximize2 className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Voice input" onClick={onMic} active={micOn}>
        <Mic className="h-3.5 w-3.5" />
      </IconBtn>
      <Divider />
      <select
        value={block}
        onChange={(e) => onBlock(e.target.value)}
        className="h-7 rounded border border-transparent bg-transparent px-1 text-[12px] text-[var(--color-text-primary)] outline-none hover:border-[var(--color-border)]"
      >
        {BLOCKS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <select
        value={font}
        onChange={(e) => onFont(e.target.value)}
        className="h-7 max-w-[88px] rounded border border-transparent bg-transparent px-1 text-[12px] text-[var(--color-text-primary)] outline-none hover:border-[var(--color-border)]"
      >
        {FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <div className="flex items-center">
        <IconBtn label="Smaller" onClick={() => onFontSize(Math.max(10, fontSize - 1))}>
          <Minus className="h-3 w-3" />
        </IconBtn>
        <span className="w-6 text-center text-[11px] tabular-nums text-[var(--color-text-secondary)]">{fontSize}</span>
        <IconBtn label="Larger" onClick={() => onFontSize(Math.min(32, fontSize + 1))}>
          <Plus className="h-3 w-3" />
        </IconBtn>
      </div>
      <Divider />
      <IconBtn label="Bold" onClick={() => onCommand("bold")}>
        <Bold className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Italic" onClick={() => onCommand("italic")}>
        <Italic className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Strikethrough" onClick={() => onCommand("strikeThrough")}>
        <Strikethrough className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Underline" onClick={() => onCommand("underline")}>
        <Underline className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Link" onClick={onLink}>
        <Link2 className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Clear formatting" onClick={() => onCommand("removeFormat")}>
        <Eraser className="h-3.5 w-3.5" />
      </IconBtn>
      <Divider />
      <label className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]">
        <span className="text-[12px] font-semibold">A</span>
        <input
          type="color"
          className="absolute inset-x-1 bottom-0.5 h-1 w-5 cursor-pointer border-0 bg-transparent p-0"
          defaultValue="#14151A"
          onChange={(e) => onColor(e.target.value)}
          aria-label="Text color"
        />
      </label>
      <label className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]">
        <Highlighter className="h-3.5 w-3.5" />
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          defaultValue="#FFF3A3"
          onChange={(e) => onHighlight(e.target.value)}
          aria-label="Highlight"
        />
      </label>
      <IconBtn label="Align left" onClick={() => onCommand("justifyLeft")}>
        <AlignLeft className="h-3.5 w-3.5" />
      </IconBtn>
      <Divider />
      <IconBtn label="Insert" onClick={() => onCommand("insertParagraph")}>
        <Plus className="h-3.5 w-3.5" />
      </IconBtn>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />;
}

function IconBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]",
        active && "bg-[var(--color-primary-light)] text-primary"
      )}
    >
      {children}
    </button>
  );
}

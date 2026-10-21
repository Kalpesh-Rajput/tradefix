"use client";

import { Eye, EyeOff, ListTree, MousePointer2, Redo2, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { DrawingStore } from "../store";
import { CATEGORY_LABELS, CATEGORY_ORDER, TOOLS, toolDef, type ToolCategory } from "../tools";
import { CATEGORY_ICONS, TOOL_ICONS } from "./toolIcons";
import { useStoreVersion } from "./useStore";

const BUTTON =
  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-[var(--color-border-subtle)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40";
const ACTIVE = "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary";

function ToolButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  expanded,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className={`${BUTTON} ${active ? ACTIVE : ""}`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </button>
  );
}

function CategoryMenu({ category, store, open, onToggle, disabled }: { category: ToolCategory; store: DrawingStore; open: boolean; onToggle: () => void; disabled: boolean }) {
  const tools = TOOLS.filter((tool) => tool.category === category);
  const activeHere = tools.some((tool) => tool.id === store.activeTool);
  const lead = tools.find((tool) => tool.id === store.activeTool) ?? tools[0];
  const Icon = activeHere ? TOOL_ICONS[lead.id] : CATEGORY_ICONS[category];
  const anchorRef = useRef<HTMLDivElement>(null);
  const box = open ? anchorRef.current?.getBoundingClientRect() : null;
  return (
    <div ref={anchorRef} className="relative">
      <ToolButton icon={Icon} label={CATEGORY_LABELS[category]} onClick={onToggle} active={activeHere} disabled={disabled} expanded={open} />
      {open && box
        ? createPortal(
        <ul
          role="menu"
          aria-label={CATEGORY_LABELS[category]}
          data-drawing-menu
          style={{ left: box.right + 4, top: Math.max(8, Math.min(box.top, window.innerHeight - tools.length * 32 - 16)) }}
          className="fixed z-50 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {tools.map((tool) => {
            const ToolIcon = TOOL_ICONS[tool.id];
            const on = store.activeTool === tool.id;
            return (
              <li key={tool.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    store.setTool(on ? null : tool.id);
                    onToggle();
                  }}
                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-[var(--color-border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${on ? "text-primary" : "text-foreground"}`}
                >
                  <ToolIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{tool.label}</span>
                  {tool.shortcut ? <kbd className="text-[10px] text-muted">Alt+{tool.shortcut}</kbd> : null}
                </button>
              </li>
            );
          })}
        </ul>,
            document.body
          )
        : null}
    </div>
  );
}

export function DrawingToolbar({
  store,
  ready,
  listOpen,
  onToggleList,
  onClearRequest,
}: {
  store: DrawingStore;
  ready: boolean;
  listOpen: boolean;
  onToggleList: () => void;
  onClearRequest: () => void;
}) {
  useStoreVersion(store);
  const [open, setOpen] = useState<ToolCategory | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!rootRef.current?.contains(target) && !target.closest("[data-drawing-menu]")) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = store.activeTool ? toolDef(store.activeTool).label : null;

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="relative z-20 flex w-10 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-border bg-surface py-1.5"
    >
      <ToolButton icon={MousePointer2} label="Select and move" onClick={() => store.setTool(null)} active={store.activeTool === null} disabled={!ready} />
      <span className="my-1 h-px w-5 bg-border" aria-hidden />
      {CATEGORY_ORDER.map((category) => (
        <CategoryMenu key={category} category={category} store={store} open={open === category} disabled={!ready} onToggle={() => setOpen(open === category ? null : category)} />
      ))}
      <span className="my-1 h-px w-5 bg-border" aria-hidden />
      <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => store.undo()} disabled={!ready || !store.canUndo} />
      <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={() => store.redo()} disabled={!ready || !store.canRedo} />
      <ToolButton
        icon={store.hiddenAll ? EyeOff : Eye}
        label={store.hiddenAll ? "Show all drawings" : "Hide all drawings"}
        onClick={() => store.setHiddenAll(!store.hiddenAll)}
        active={store.hiddenAll}
        disabled={!ready}
      />
      <ToolButton icon={ListTree} label="Object list" onClick={onToggleList} active={listOpen} disabled={!ready} expanded={listOpen} />
      <div className="mt-auto" />
      <ToolButton icon={Trash2} label="Remove all drawings" onClick={onClearRequest} disabled={!ready || store.drawings.length === 0} />
      <span className="sr-only" role="status" aria-live="polite">
        {active ? `${active} tool active. Press Escape to cancel.` : ""}
      </span>
    </div>
  );
}

"use client";

import { Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";

import type { DrawingStore } from "../store";
import { toolDef } from "../tools";
import { IconToggle } from "./fields";
import { TOOL_ICONS } from "./toolIcons";
import { useStoreVersion } from "./useStore";

export function ObjectList({ store, onClose }: { store: DrawingStore; onClose: () => void }) {
  useStoreVersion(store);
  const items = [...store.drawings].reverse();
  return (
    <section aria-label="Drawing objects" className="absolute left-2 top-2 z-20 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg">
      <header className="mb-1 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold text-foreground">Objects ({items.length})</h2>
        <button type="button" onClick={onClose} className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          Close
        </button>
      </header>
      {items.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-muted">No drawings yet. Pick a tool on the left.</p>
      ) : (
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = TOOL_ICONS[item.tool];
            const selected = store.selectedId === item.id;
            return (
              <li key={item.id} className={`flex items-center gap-0.5 rounded-md ${selected ? "bg-primary/10" : ""}`}>
                <button
                  type="button"
                  onClick={() => store.select(item.id)}
                  aria-pressed={selected}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-foreground hover:bg-[var(--color-border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: item.style.color }} strokeWidth={1.75} />
                  <span className={`truncate ${item.visible ? "" : "text-muted line-through"}`}>{toolDef(item.tool).label}</span>
                </button>
                <IconToggle label={item.visible ? "Hide" : "Show"} onClick={() => store.patch(item.id, { visible: !item.visible })}>
                  {item.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </IconToggle>
                <IconToggle label={item.locked ? "Unlock" : "Lock"} pressed={item.locked} onClick={() => store.patch(item.id, { locked: !item.locked })}>
                  {item.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </IconToggle>
                <IconToggle label="Delete" danger onClick={() => (item.locked ? undefined : store.remove(item.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconToggle>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

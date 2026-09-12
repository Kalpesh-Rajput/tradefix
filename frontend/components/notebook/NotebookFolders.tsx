"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, FolderPlus, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SYSTEM_FOLDERS, type NotebookFolderId } from "@/components/notebook/types";
import { useToast } from "@/components/ui/Toast";
import {
  useCreateNotebookFolder,
  useDeleteNotebookFolder,
  useUpdateNotebookFolder,
} from "@/lib/hooks/useNotebookFolders";
import type { NotebookFolder } from "@/lib/types";

export function NotebookFolders({
  folder,
  onSelect,
  collapsed,
  onToggle,
  customFolders,
  accountId,
}: {
  folder: NotebookFolderId;
  onSelect: (folder: NotebookFolderId) => void;
  collapsed: boolean;
  onToggle: () => void;
  customFolders: NotebookFolder[];
  accountId?: string;
}) {
  const toast = useToast();
  const [mobile, setMobile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const create = useCreateNotebookFolder();
  const update = useUpdateNotebookFolder();
  const remove = useDeleteNotebookFolder();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const rail = collapsed && !mobile;

  async function submitCreate() {
    const name = draft.trim();
    if (!accountId || !name) {
      setCreating(false);
      setDraft("");
      return;
    }
    try {
      const folderRow = await create.mutateAsync({ account_id: accountId, name });
      setCreating(false);
      setDraft("");
      onSelect(folderRow.id);
      toast.success("Folder created");
    } catch (err) {
      toast.error("Couldn’t create folder", err instanceof Error ? err.message : undefined);
    }
  }

  async function submitRename(id: string) {
    const name = renameValue.trim();
    if (!accountId || !name) {
      setRenamingId(null);
      return;
    }
    try {
      await update.mutateAsync({ id, accountId, name });
      setRenamingId(null);
      toast.success("Folder renamed");
    } catch (err) {
      toast.error("Couldn’t rename folder", err instanceof Error ? err.message : undefined);
    }
  }

  async function submitDelete(id: string) {
    if (!accountId) return;
    if (!window.confirm("Delete this folder? Notes stay in Daily Journal.")) return;
    try {
      await remove.mutateAsync({ id, accountId });
      setMenuId(null);
      if (folder === id) onSelect("daily");
      toast.success("Folder deleted");
    } catch (err) {
      toast.error("Couldn’t delete folder", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <aside
      className={clsx(
        "flex h-full min-h-0 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]",
        rail ? "w-12" : "w-full md:w-[232px]"
      )}
    >
      {rail ? (
        <div className="flex min-h-0 flex-1 flex-col items-center py-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            aria-label="Expand folders"
            title="Expand folders"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => {
              onToggle();
              setCreating(true);
            }}
            className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            aria-label="Add folder"
            title="Add folder"
          >
            <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <nav className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
            {SYSTEM_FOLDERS.map((item) => (
              <RailButton
                key={item.id}
                label={item.label}
                initial={item.initial}
                active={item.id === folder}
                onClick={() => onSelect(item.id)}
              />
            ))}
            {customFolders.map((item) => (
              <RailButton
                key={item.id}
                label={item.name}
                initial={item.name.slice(0, 1).toUpperCase()}
                active={item.id === folder}
                onClick={() => onSelect(item.id)}
              />
            ))}
          </nav>
        </div>
      ) : (
        <>
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-2">
            <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Folders
            </p>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setDraft("");
                }}
                disabled={!accountId || create.isPending}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-primary hover:bg-[var(--color-primary-very-light)] disabled:opacity-50"
              >
                <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Add
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="hidden h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] md:inline-flex"
                aria-label="Collapse folders"
                title="Collapse folders"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <nav className="flex flex-col">
              {SYSTEM_FOLDERS.map((item) => (
                <FolderRow
                  key={item.id}
                  label={item.label}
                  active={item.id === folder}
                  onClick={() => onSelect(item.id)}
                />
              ))}
            </nav>
            {creating ? (
              <form
                className="mt-1 px-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitCreate();
                }}
              >
                <input
                  autoFocus
                  value={draft}
                  maxLength={48}
                  placeholder="Folder name"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (!draft.trim()) setCreating(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setCreating(false);
                      setDraft("");
                    }
                  }}
                  className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-[12px] outline-none focus:border-[var(--color-primary)]"
                />
              </form>
            ) : null}
            {customFolders.length ? (
              <nav className="mt-2 flex flex-col border-t border-[var(--color-border)] pt-2">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  My folders
                </p>
                {customFolders.map((item) =>
                  renamingId === item.id ? (
                    <form
                      key={item.id}
                      className="px-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submitRename(item.id);
                      }}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        maxLength={48}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => void submitRename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-[12px] outline-none focus:border-[var(--color-primary)]"
                      />
                    </form>
                  ) : (
                    <FolderRow
                      key={item.id}
                      label={item.name}
                      active={item.id === folder}
                      onClick={() => onSelect(item.id)}
                      menuOpen={menuId === item.id}
                      onMenu={() => setMenuId((id) => (id === item.id ? null : item.id))}
                      onRename={() => {
                        setMenuId(null);
                        setRenamingId(item.id);
                        setRenameValue(item.name);
                      }}
                      onDelete={() => void submitDelete(item.id)}
                    />
                  )
                )}
              </nav>
            ) : null}
            {!accountId ? (
              <p className="px-2 pt-3 text-[11px] text-[var(--color-text-muted)]">Select a portfolio to add folders.</p>
            ) : null}
          </div>
        </>
      )}
    </aside>
  );
}

function RailButton({
  label,
  initial,
  active,
  onClick,
}: {
  label: string;
  initial: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={clsx(
        "relative flex h-8 w-8 items-center justify-center rounded-md text-[12px] font-semibold",
        active
          ? "bg-[var(--color-primary-light)] text-primary"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
      )}
    >
      {active ? <span className="absolute left-0 top-1.5 h-5 w-0.5 rounded-r bg-[var(--color-primary)]" /> : null}
      {initial}
    </button>
  );
}

function FolderRow({
  label,
  active,
  onClick,
  menuOpen,
  onMenu,
  onRename,
  onDelete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  menuOpen?: boolean;
  onMenu?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onMenu?.();
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuOpen, onMenu]);

  return (
    <div
      className={clsx(
        "relative mb-0.5 flex h-9 items-center rounded-md",
        active ? "bg-[var(--color-primary-light)] text-primary" : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
      )}
    >
      {active ? <span className="absolute left-0 top-1.5 h-6 w-0.5 rounded-r bg-[var(--color-primary)]" /> : null}
      <button type="button" onClick={onClick} className="min-w-0 flex-1 truncate px-2.5 text-left text-[13px]">
        {label}
      </button>
      {onMenu ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={onMenu}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            aria-label="Folder actions"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-30 mt-1 w-32 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]">
              <button
                type="button"
                onClick={onRename}
                className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-[var(--color-primary-very-light)]"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="block w-full px-3 py-1.5 text-left text-[12px] text-negative hover:bg-[var(--color-danger-bg)]"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

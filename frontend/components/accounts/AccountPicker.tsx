"use client";

import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export interface AccountPickerItem {
  id: string;
  name: string;
}

interface AccountPickerProps {
  accounts: AccountPickerItem[];
  value: string;
  onChange: (id: string) => void;
  getLabel?: (account: AccountPickerItem) => string;
  extraOptions?: { id: string; label: string }[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  tone?: "settings" | "trade";
  size?: "md" | "sm";
}

export function AccountPicker({
  accounts,
  value,
  onChange,
  getLabel = (account) => account.name,
  extraOptions = [],
  disabled,
  placeholder = "Select account",
  className,
  tone = "settings",
  size = "md",
}: AccountPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 240 && rect.top > spaceBelow;
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        zIndex: 80,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedAccount = accounts.find((account) => account.id === value);
  const extra = extraOptions.find((option) => option.id === value);
  const label = selectedAccount ? getLabel(selectedAccount) : extra?.label || placeholder;

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            style={menuStyle}
            className={clsx(
              "overflow-hidden rounded-xl border shadow-[var(--shadow-dropdown)]",
              tone === "trade"
                ? "border-[var(--color-border)] bg-[var(--color-surface)]"
                : "border-border bg-surface"
            )}
          >
            <ul className="max-h-56 overflow-y-auto py-1">
              {accounts.map((account) => {
                const selected = account.id === value;
                return (
                  <li key={account.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(account.id);
                        setOpen(false);
                      }}
                      className={clsx(
                        "flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-sm transition",
                        tone === "trade" ? "hover:bg-[var(--color-surface-secondary)]" : "hover:bg-foreground/5",
                        selected ? "text-primary" : tone === "trade" ? "text-[var(--color-text-primary)]" : "text-foreground"
                      )}
                    >
                      <span className="min-w-0 truncate">{getLabel(account)}</span>
                      {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
              {extraOptions.map((option) => {
                const selected = option.id === value;
                return (
                  <li key={option.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                      className={clsx(
                        "flex h-9 w-full items-center px-3 text-left text-sm transition hover:bg-foreground/5",
                        selected ? "text-primary" : "text-muted"
                      )}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
              {!accounts.length && !extraOptions.length ? (
                <li className="px-3 py-2 text-sm text-muted">No accounts</li>
              ) : null}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        disabled={disabled || (!accounts.length && !extraOptions.length)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-40",
          tone === "trade"
            ? clsx(
                "border-[var(--color-border)] bg-[var(--color-surface)] font-medium text-[var(--color-text-primary)] hover:border-[var(--color-text-secondary)] focus-visible:border-primary focus-visible:shadow-[var(--focus-ring)]",
                size === "sm" ? "h-9 rounded-lg px-2.5 text-[13px]" : "h-12 rounded-xl"
              )
            : "py-2.5 border-border bg-background text-foreground hover:border-primary/40 focus-visible:border-primary/40"
        )}
      >
        <span className={clsx("min-w-0 truncate", tone === "trade" && selectedAccount ? "font-medium" : "", tone === "trade" && !selectedAccount && !extra && "font-normal text-[var(--color-text-muted)]")}>
          {label}
        </span>
        <ChevronDown
          className={clsx(
            "shrink-0",
            tone === "trade" ? "h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-150" : "h-4 w-4 text-muted transition",
            open && "rotate-180"
          )}
        />
      </button>
      {menu}
    </div>
  );
}

"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { useNotifications, useReadNotification } from "@/lib/hooks/useAgents";

export function NotificationBell() {
  const { t } = useLocale();
  const router = useRouter();
  const query = useNotifications();
  const read = useReadNotification();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const items = query.data ?? [];
  const unread = items.filter((item) => !item.read_at).length;

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
        aria-label={t("common.notifications")}
        title={t("common.notifications")}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={1.75} />
        {unread > 0 ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
          <div className="border-b border-[var(--color-border)] px-3 py-2 text-[12px] font-semibold">Notifications</div>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-[var(--color-text-tertiary)]">No agent activity yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left hover:bg-[var(--color-primary-very-light)]"
                    onClick={() => {
                      if (!item.read_at) void read.mutateAsync(item.id);
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <span className="block text-[12px] font-medium text-[var(--color-text-primary)]">{item.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[var(--color-text-secondary)]">{item.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

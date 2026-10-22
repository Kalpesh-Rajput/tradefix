"use client";

import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useNotifications, useReadNotification } from "@/lib/hooks/useAgents";
import { MOTION } from "@/lib/motion";

function relativeTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : formatDistanceToNowStrict(date, { addSuffix: true });
}

export function NotificationBell() {
  const { t } = useLocale();
  const router = useRouter();
  const query = useNotifications();
  const read = useReadNotification();
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevUnread = useRef<number | null>(null);
  const panelId = useId();
  const items = query.data ?? [];
  const unread = items.filter((item) => !item.read_at).length;
  const label = unread > 0 ? `${t("common.notifications")} (${unread})` : t("common.notifications");

  useEffect(() => {
    if (prevUnread.current !== null && unread > prevUnread.current) {
      setRinging(true);
      const handle = window.setTimeout(() => setRinging(false), 600);
      prevUnread.current = unread;
      return () => window.clearTimeout(handle);
    }
    prevUnread.current = unread;
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Tooltip content={t("common.notifications")} side="bottom">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={clsx(
            "group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-[background-color,border-color,color,transform] duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] active:scale-[0.96] motion-reduce:active:scale-100",
            open
              ? "border-[color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))] text-[var(--color-text-primary)]"
              : "border-[var(--color-border)]"
          )}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          data-testid="notification-bell"
        >
          <Bell className={clsx("tf-icon-ring h-3.5 w-3.5", ringing && "is-ringing")} strokeWidth={1.75} aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="tf-num absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-[var(--color-surface)]"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </Tooltip>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label={t("common.notifications")}
            {...MOTION.dropdown}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 z-dropdown mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated,var(--color-surface))] shadow-dropdown"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle,var(--color-border))] px-3.5 py-2.5">
              <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{t("common.notifications")}</span>
              {unread > 0 ? (
                <span className="tf-num rounded-full bg-[var(--color-primary-very-light)] px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {unread} new
                </span>
              ) : null}
            </div>
            {query.isLoading ? (
              <div className="space-y-2 p-3" aria-busy="true">
                <Skeleton className="h-9 rounded-md" />
                <Skeleton className="h-9 rounded-md" />
              </div>
            ) : query.isError ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <AlertCircle className="h-5 w-5 text-destructive" strokeWidth={1.75} aria-hidden />
                <p className="text-[12px] text-[var(--color-text-secondary)]">Notifications could not be loaded.</p>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="rounded-md px-2 py-1 text-[12px] font-medium text-primary hover:bg-[var(--color-primary-very-light)]"
                >
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary-very-light)] text-primary">
                  <BellOff className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-[12px] font-medium text-[var(--color-text-primary)]">You&apos;re all caught up</p>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">Agent activity and alerts appear here.</p>
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto overscroll-contain py-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="relative flex w-full gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--color-primary-very-light)] focus-visible:bg-[var(--color-primary-very-light)]"
                      onClick={() => {
                        if (!item.read_at) void read.mutateAsync(item.id);
                        setOpen(false);
                        router.push(item.href);
                      }}
                    >
                      <span
                        aria-hidden
                        className={clsx(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          item.read_at ? "bg-transparent" : "bg-primary"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-[var(--color-text-primary)]">
                          {item.title}
                          {!item.read_at ? <span className="sr-only"> (unread)</span> : null}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-[var(--color-text-secondary)]">
                          {item.body}
                        </span>
                        <time dateTime={item.created_at} className="mt-1 block text-[10px] text-[var(--color-text-tertiary)]">
                          {relativeTime(item.created_at)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

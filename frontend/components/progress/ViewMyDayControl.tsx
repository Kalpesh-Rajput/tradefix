"use client";

import clsx from "clsx";
import { CalendarDays, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DayViewCalendar } from "@/components/dayview/DayViewCalendar";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { localIso } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";
import { useStartProgressDay } from "@/lib/hooks/useProgressTracker";
import { maxPlannableMyDay, myDayHref } from "@/lib/my-day";

export function ViewMyDayControl({
  accountId,
  variant = "button",
  selectedDate,
}: {
  accountId?: string;
  variant?: "button" | "icon";
  selectedDate?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { dateKey } = useLocale();
  const startDay = useStartProgressDay();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = dateKey(new Date());
  const month = today.slice(0, 7) + "-01";
  const monthEnd = localIso(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const [calStart, setCalStart] = useState(month);
  const [calEnd, setCalEnd] = useState(monthEnd);
  const { data: calendar } = useCalendar(calStart, calEnd, accountId, { enabled: open && !!accountId });
  const highlighted = selectedDate ?? today;
  const maxDate = maxPlannableMyDay(today);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  function go(date: string) {
    if (date > maxDate) {
      toast.info("You can plan up to 30 days ahead.");
      return;
    }
    setOpen(false);
    router.push(myDayHref(date));
    if (date <= today) {
      void startDay.mutateAsync(date).catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Could not start that day");
      });
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={
          variant === "icon"
            ? "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            : "dash-btn-primary text-on-accent"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={variant === "icon" ? "Choose a day" : "View my day"}
        title={variant === "icon" ? "Choose a day" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {variant === "icon" ? (
          <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <>
            <Rocket className="h-3.5 w-3.5" strokeWidth={2} />
            View my day
          </>
        )}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose a day to open"
          className={clsx(
            "absolute z-40 mt-2 w-[280px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-dropdown)]",
            variant === "icon" ? "left-0" : "right-0"
          )}
        >
          <DayViewCalendar
            days={calendar?.days ?? []}
            month={calStart}
            variant="picker"
            selectedDate={highlighted}
            onMonthChange={(start, end) => {
              setCalStart(start);
              setCalEnd(end);
            }}
            onSelectDate={go}
          />
          <p className={clsx("mt-2 text-center text-[11px] text-[var(--color-text-muted)]")}>
            Click a date to open that day’s plan and edit it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

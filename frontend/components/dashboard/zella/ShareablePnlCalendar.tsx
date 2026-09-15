"use client";

import { useRef } from "react";

import {
  CalendarCaptureButton,
  useCalendarShare,
} from "@/components/calendar/share/CalendarShareFlow";
import {
  PnlCalendarHeatmap,
  type CalendarDayMarks,
  type PnlHeatmapDay,
} from "@/components/dashboard/zella/PnlCalendarHeatmap";
import { useAuth } from "@/components/providers/AuthProvider";
import type { CalendarDay } from "@/lib/types";

export function ShareablePnlCalendar({
  days,
  month,
  className,
  size = "compact",
  selectedDate,
  marks,
  onMonthChange,
  onSelectDate,
}: {
  days: Array<PnlHeatmapDay | CalendarDay>;
  month?: string | null;
  className?: string;
  size?: "compact" | "page";
  selectedDate?: string | null;
  marks?: Map<string, CalendarDayMarks>;
  onMonthChange?: (start: string, end: string) => void;
  onSelectDate?: (date: string) => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const monthKey = (month ?? "").slice(0, 7) || "calendar";
  const share = useCalendarShare(`tradefix-calendar-${monthKey}`);

  return (
    <>
      <PnlCalendarHeatmap
        captureRef={captureRef}
        className={className}
        size={size}
        days={days}
        month={month}
        selectedDate={selectedDate}
        marks={marks}
        monthlyGoal={user?.monthly_goal}
        dailyGoal={user?.daily_goal}
        headerActions={
          <CalendarCaptureButton capturing={share.capturing} onClick={() => share.open(captureRef.current)} />
        }
        onMonthChange={onMonthChange}
        onSelectDate={onSelectDate}
      />
      {share.dialogs}
    </>
  );
}

"use client";

import clsx from "clsx";
import {
  BarChart3,
  Bot,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  Gift,
  House,
  ListChecks,
  LogOut,
  MessageSquare,
  Newspaper,
  NotebookPen,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { firstName } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

const NAV = [
  { href: "/today", label: "Today", icon: House, testId: "nav-today" },
  { href: "/journal", label: "Trade Log", icon: ClipboardList, testId: "nav-tradeLog" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, testId: "nav-analytics" },
  { href: "/diary", label: "Journal", icon: NotebookPen, testId: "nav-journal" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, testId: "nav-calendar" },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase, testId: "nav-portfolio" },
  { href: "/agents", label: "Agents", icon: Bot, testId: "nav-agents" },
  { href: "/chat", label: "Max AI", icon: MessageSquare, testId: "nav-maxAi" },
  { href: "/news", label: "News", icon: Newspaper, testId: "nav-news" },
  { href: "/backtest", label: "Backtest", icon: FlaskConical, testId: "nav-backtesting" },
  { href: "/mindset", label: "Mindset", icon: Brain, testId: "nav-mindset" },
  { href: "/trading-plan", label: "Trading Plan", icon: ListChecks, testId: "nav-tradingPlan" },
  { href: "/settings/profile", label: "Perks", icon: Gift, testId: "nav-perks" },
] as const;

function CandlestickMark() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden>
      <line x1="2" y1="2" x2="2" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="0" y="5" width="4" height="9" rx="0.5" fill="currentColor" />
      <line x1="2" y1="14" x2="2" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="5" x2="9" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
      <rect x="7" y="8" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.65" />
      <line x1="9" y1="14" x2="9" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
      <line x1="16" y1="0" x2="16" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14" y="2" width="4" height="12" rx="0.5" fill="currentColor" />
      <line x1="16" y1="14" x2="16" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Sidebar({ expanded: forceExpanded = false }: { expanded?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [hovered, setHovered] = useState(false);
  const open = forceExpanded || hovered;
  const name = firstName(user?.name, user?.email);
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className={clsx("relative shrink-0", forceExpanded ? "w-[220px]" : "w-12")}>
      <aside
        onMouseEnter={() => !forceExpanded && setHovered(true)}
        onMouseLeave={() => !forceExpanded && setHovered(false)}
        className={clsx(
          "absolute left-0 top-0 z-40 flex h-screen [height:100dvh] flex-col overflow-hidden border-r border-white/[0.06] bg-black py-4 transition-[width,box-shadow] duration-200 ease-out",
          open ? "w-[220px]" : "w-12",
          open && !forceExpanded && "shadow-[8px_0_24px_rgba(0,0,0,0.45)]"
        )}
      >
        <Link href="/today" className="mb-8 flex shrink-0 items-center gap-2.5 px-3">
          <span className="flex w-6 shrink-0 items-center justify-center text-white">
            <CandlestickMark />
          </span>
          <span
            className={clsx(
              "whitespace-nowrap text-sm font-semibold tracking-tight text-white transition-opacity duration-150",
              open ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            trade<span className="text-primary">fix</span>
          </span>
        </Link>

        <nav className="flex w-full flex-1 flex-col gap-0.5 overflow-y-auto px-1.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/today" && Boolean(pathname?.startsWith(item.href + "/")));
            const key = `${item.label}-${item.href}`;

            return (
              <Link
                key={key}
                href={item.href}
                title={item.label}
                data-testid={item.testId}
                className={clsx(
                  "relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-zinc-500 hover:bg-white/5 hover:text-white"
                )}
              >
                {active && <div className="absolute bottom-1 left-0 top-1 w-0.5 rounded-r bg-primary" />}
                <div className="relative shrink-0">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <span
                  className={clsx(
                    "truncate transition-opacity duration-150",
                    open ? "opacity-100" : "pointer-events-none opacity-0"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 flex w-full flex-col gap-0.5 border-t border-white/[0.06] px-1.5 pt-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            title="Get the app"
          >
            <Smartphone className="h-4 w-4 shrink-0" />
            <span className={clsx("truncate transition-opacity", open ? "opacity-100" : "opacity-0")}>App</span>
          </button>

          <Link
            href="/settings/profile"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5"
            title="Settings"
          >
            <span className="relative flex h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(user.avatar_url) || undefined}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-[10px] font-semibold text-white">
                  {initial}
                </span>
              )}
            </span>
            <span className={clsx("truncate text-sm text-zinc-300 transition-opacity", open ? "opacity-100" : "opacity-0")}>
              {user?.name || name}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-500 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Sign Out"
            data-testid="nav-sign-out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={clsx("truncate transition-opacity", open ? "opacity-100" : "opacity-0")}>Sign Out</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

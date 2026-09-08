"use client";

import clsx from "clsx";
import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useHeaderActionsSlot } from "@/components/layout/HeaderActions";
import { NavCollapseButton } from "@/components/layout/NavCollapseButton";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { isJournalPath, pageTitleKey } from "@/lib/nav";

export function AppHeader() {
  const { t } = useLocale();
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { actions, subtitle } = useHeaderActionsSlot();
  const pathname = usePathname();
  const showJournalToggle = isJournalPath(pathname) && collapsed;

  return (
    <header
      className={clsx(
        "relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)] sm:px-4",
        subtitle ? "h-[52px]" : "h-12"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] md:hidden"
          aria-label={mobileOpen ? t("common.closeMenu") : t("common.openMenu")}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {showJournalToggle && <NavCollapseButton variant="light" />}
        <div className="min-w-0">
          <h1
            className={clsx(
              "truncate font-semibold tracking-tight text-[var(--color-text-primary)]",
              subtitle ? "text-[17px] leading-5" : "text-[17px] leading-6"
            )}
          >
            {t(pageTitleKey(pathname))}
          </h1>
          {subtitle ? (
            <p className="truncate text-[11px] font-normal leading-4 text-[var(--color-text-tertiary)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        {actions}
        <Link
          href="/settings/notifications"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
          aria-label={t("common.notifications")}
          title={t("common.notifications")}
        >
          <Bell className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

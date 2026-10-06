"use client";

import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { BackButton } from "@/components/layout/AppNavigation";
import { useHeaderActionsSlot } from "@/components/layout/HeaderActions";
import { NavCollapseButton } from "@/components/layout/NavCollapseButton";
import { NotificationBell } from "@/components/layout/NotificationBell";
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
        "relative z-10 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text-primary)] sm:px-4",
        subtitle ? "min-h-[52px]" : "min-h-12"
      )}
    >
      <div className="flex min-w-[10.5rem] max-w-full flex-1 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] md:hidden"
          aria-label={mobileOpen ? t("common.closeMenu") : t("common.openMenu")}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {showJournalToggle && <NavCollapseButton variant="light" />}
        <BackButton />
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

      <div className="flex w-full min-w-0 basis-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:max-w-full lg:basis-auto lg:justify-end">
        {actions}
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}

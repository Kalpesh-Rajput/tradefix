"use client";

import clsx from "clsx";
import { Bell, LogOut, Menu, Settings, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { BrandLockup } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { firstName } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = firstName(user?.name, user?.email);
  const initial = name.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sidebar-chrome z-40 flex h-12 shrink-0 items-center justify-between gap-3 bg-sidebar px-3 text-sidebar-foreground sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#c7c2d0] transition-colors hover:bg-white/10 hover:text-white md:hidden"
          aria-label={mobileOpen ? t("common.closeMenu") : t("common.openMenu")}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link href="/home" title="TradeFix" className="min-w-0">
          <BrandLockup />
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Link
          href="/chat"
          className="hidden items-center gap-2 rounded-full px-2 py-1 text-[12px] font-medium text-white/90 transition-colors hover:bg-white/10 sm:inline-flex"
          title={t("nav.coach")}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/80 text-on-accent">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <span className="hidden lg:inline">{t("nav.coach")}</span>
        </Link>

        <ThemeToggle className="hidden h-9 w-9 items-center justify-center rounded-xl text-[#c7c2d0] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 sm:inline-flex" />

        <Link
          href="/settings/notifications"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#c7c2d0] transition-colors hover:bg-white/10 hover:text-white"
          aria-label={t("common.notifications")}
          title={t("common.notifications")}
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
        </Link>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center rounded-full p-0.5 ring-1 ring-white/15 transition hover:ring-white/40"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("common.profile")}
            title={user?.name || name}
          >
            <span className="relative flex h-8 w-8 overflow-hidden rounded-full">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(user.avatar_url) || undefined}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-white/10 text-[11px] font-semibold text-white">
                  {initial}
                </span>
              )}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-dropdown"
            >
              <div className="border-b border-[var(--color-border)] px-3 py-2">
                <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                  {user?.name || name}
                </p>
                <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">{user?.email}</p>
              </div>
              <HeaderMenuLink href="/settings/profile" icon={UserRound} onClick={() => setMenuOpen(false)}>
                {t("common.profile")}
              </HeaderMenuLink>
              <HeaderMenuLink href="/settings/system" icon={Settings} onClick={() => setMenuOpen(false)}>
                {t("common.settings")}
              </HeaderMenuLink>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-destructive transition-colors hover:bg-destructive/10"
                data-testid="nav-sign-out"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                {t("common.signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function HeaderMenuLink({
  href,
  icon: Icon,
  onClick,
  children,
}: {
  href: string;
  icon: typeof Settings;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-primary-very-light)]"
      )}
    >
      <Icon className="h-4 w-4 text-[var(--color-text-tertiary)]" strokeWidth={1.75} />
      {children}
    </Link>
  );
}

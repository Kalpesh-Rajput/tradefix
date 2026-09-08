"use client";

import clsx from "clsx";
import { LogOut, Settings, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { firstName } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export function RailProfile() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { setMobileOpen } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, bottom: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = firstName(user?.name, user?.email);
  const avatarSrc = mediaUrl(user?.avatar_url);

  useEffect(() => {
    if (!menuOpen) return;

    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        left: Math.min(rect.left, window.innerWidth - 240),
        bottom: window.innerHeight - rect.top + 8,
      });
    }

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    place();
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center rounded-full p-0.5 ring-1 ring-white/20 transition hover:ring-white/45"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t("common.profile")}
        title={user?.name || name}
      >
        <span className="relative flex h-8 w-8 overflow-hidden rounded-full bg-black">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <Image
              src="/logo.png"
              alt="TradeFix"
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          )}
        </span>
      </button>

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ left: menuPos.left, bottom: menuPos.bottom }}
            className="fixed z-[80] w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-dropdown"
          >
            <div className="border-b border-[var(--color-border)] px-3 py-2">
              <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                {user?.name || name}
              </p>
              <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">{user?.email}</p>
            </div>
            <MenuLink
              href="/settings/profile"
              icon={UserRound}
              onClick={() => {
                setMenuOpen(false);
                setMobileOpen(false);
              }}
            >
              {t("common.profile")}
            </MenuLink>
            <MenuLink
              href="/settings/system"
              icon={Settings}
              onClick={() => {
                setMenuOpen(false);
                setMobileOpen(false);
              }}
            >
              {t("common.settings")}
            </MenuLink>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setMobileOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-destructive transition-colors hover:bg-destructive/10"
              data-testid="nav-sign-out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              {t("common.signOut")}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

function MenuLink({
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

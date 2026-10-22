"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown, LogOut, Palette, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { Avatar } from "@/components/ui/Avatar";
import { firstName } from "@/lib/format";
import { MOTION } from "@/lib/motion";
import { mediaUrl } from "@/lib/media";

const MENU_WIDTH = 240;
const MENU_HEIGHT_ESTIMATE = 280;

export function RailProfile() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { setMobileOpen } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top?: number; bottom?: number; up: boolean }>({ left: 0, bottom: 0, up: true });
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const name = firstName(user?.name, user?.email);
  const avatarSrc = mediaUrl(user?.avatar_url);
  const plan = user?.plan && user.plan !== "free" ? user.plan : null;

  function close(restoreFocus: boolean) {
    setMenuOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!menuOpen) return;

    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
      const up = rect.top >= MENU_HEIGHT_ESTIMATE || rect.top > window.innerHeight - rect.bottom;
      setMenuPos(up ? { left, bottom: window.innerHeight - rect.top + 8, up } : { left, top: rect.bottom + 8, up });
    }

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    }

    place();
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (index + 1) % items.length;
    else if (e.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "Tab") {
      setMenuOpen(false);
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      items[next].focus();
    }
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const onNavigate = () => {
    close(false);
    setMobileOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="group flex items-center rounded-full p-0.5 ring-1 ring-sidebar-border outline-none transition-[box-shadow,transform] duration-base ease-out-expo hover:scale-[1.04] hover:ring-[var(--color-sidebar-indicator,hsl(var(--primary)))] focus-visible:ring-2 focus-visible:ring-[var(--color-sidebar-indicator,hsl(var(--primary)))] active:scale-95 aria-expanded:ring-2 aria-expanded:ring-[var(--color-sidebar-indicator,hsl(var(--primary)))] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        aria-label={`${t("common.profile")}: ${user?.name || name}`}
        data-testid="rail-profile"
      >
        <Avatar src={avatarSrc} name={user?.name} email={user?.email} size="sm" />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                ref={menuRef}
                id={menuId}
                role="menu"
                aria-label={t("common.profile")}
                onKeyDown={onMenuKeyDown}
                {...MOTION.dropup}
                style={{ left: menuPos.left, top: menuPos.top, bottom: menuPos.bottom, width: MENU_WIDTH, transformOrigin: menuPos.up ? "bottom left" : "top left" }}
                className="fixed z-popover overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated,var(--color-surface))] p-1 shadow-dropdown"
              >
                <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
                  <Avatar src={avatarSrc} name={user?.name} email={user?.email} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                      <span className="truncate">{user?.name || name}</span>
                      {plan ? (
                        <span className="tf-champagne-chip shrink-0" data-testid="profile-plan">
                          <Crown className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
                          {plan}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">{user?.email}</p>
                  </div>
                </div>
                <div className="my-1 h-px bg-[var(--color-border-subtle,var(--color-border))]" role="separator" />
                <MenuLink href="/settings/profile" icon={UserRound} onClick={onNavigate}>
                  {t("common.profile")}
                </MenuLink>
                <MenuLink href="/settings/appearance" icon={Palette} onClick={onNavigate}>
                  {t("settings.nav.appearance")}
                </MenuLink>
                <MenuLink href="/settings/system" icon={Settings} onClick={onNavigate} iconClassName="tf-icon-spin">
                  {t("common.settings")}
                </MenuLink>
                <div className="my-1 h-px bg-[var(--color-border-subtle,var(--color-border))]" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close(false);
                    setMobileOpen(false);
                    logout();
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10"
                  data-testid="nav-sign-out"
                >
                  <LogOut className="tf-icon-nudge h-4 w-4" strokeWidth={1.75} aria-hidden />
                  {t("common.signOut")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

function MenuLink({
  href,
  icon: Icon,
  onClick,
  iconClassName,
  children,
}: {
  href: string;
  icon: typeof Settings;
  onClick: () => void;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--color-text-primary)] outline-none transition-colors hover:bg-[var(--color-primary-very-light)] focus-visible:bg-[var(--color-primary-very-light)]"
    >
      <Icon
        className={`h-4 w-4 text-[var(--color-text-tertiary)] transition-colors group-hover:text-[var(--color-primary)] ${iconClassName ?? ""}`}
        strokeWidth={1.75}
        aria-hidden
      />
      {children}
    </Link>
  );
}

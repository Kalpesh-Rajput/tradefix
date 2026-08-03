"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Bell,
  CreditCard,
  Goal,
  HelpCircle,
  Monitor,
  Palette,
  Settings2,
  Sparkles,
  Target,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const NAV = [
  { href: "/settings/system", label: "System", icon: Monitor },
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/subscription", label: "Subscription", icon: CreditCard },
  { href: "/settings/accounts", label: "Accounts", icon: Wallet },
  { href: "/settings/trading-defaults", label: "Trading Defaults", icon: Settings2 },
  { href: "/settings/goals", label: "Goals", icon: Goal },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/coaching", label: "Coaching", icon: Sparkles },
  { href: "/settings/support", label: "Support", icon: HelpCircle },
] as const;

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col bg-black md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-white/[0.06] bg-black md:w-[220px] md:border-b-0 md:border-r">
        <div className="space-y-4 px-4 py-5">
          <Link
            href="/today"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight text-white">Settings</h1>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:pb-6">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[900px] px-5 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}

export function SettingsPageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SettingsField({
  label,
  hint,
  children,
  error,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">{hint}</p>}
      {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export function SettingsInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/40",
        props.className
      )}
    />
  );
}

export function SettingsTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full resize-none rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/40",
        props.className
      )}
    />
  );
}

export function SettingsSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none transition focus:border-primary/40",
        props.className
      )}
    />
  );
}

export function SettingsToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div>
        <div className="text-sm text-white">{label}</div>
        {description && <div className="mt-0.5 text-xs text-zinc-500">{description}</div>}
      </div>
      <span
        className={clsx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-zinc-700"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "left-4" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

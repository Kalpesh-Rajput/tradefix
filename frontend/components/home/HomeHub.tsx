"use client";

import clsx from "clsx";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Building2,
  CalendarDays,
  FlaskConical,
  HelpCircle,
  LineChart,
  ListChecks,
  Newspaper,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { firstName } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";

export function HomeHub() {
  const { user } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const name = firstName(user?.name, user?.email);

  const greetingKey = useMemo<MessageKey>(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "dashboard.greeting.morning";
    if (hour < 17) return "dashboard.greeting.afternoon";
    return "dashboard.greeting.evening";
  }, []);

  const prompts: { labelKey: MessageKey; href: string }[] = [
    { labelKey: "home.prompt.bestSetups", href: "/chat?q=" + encodeURIComponent("Show my best setups") },
    { labelKey: "home.prompt.yesterday", href: "/trades" },
    { labelKey: "home.prompt.mistakes", href: "/chat?q=" + encodeURIComponent("What mistakes am I repeating?") },
    { labelKey: "home.prompt.gamePlan", href: "/trading-plan" },
    { labelKey: "home.prompt.askAnything", href: "/chat" },
  ];

  const products: {
    href: string;
    titleKey: MessageKey;
    descKey: MessageKey;
    icon: typeof NotebookPen;
    tone: string;
  }[] = [
    {
      href: "/today",
      titleKey: "home.explore.journal",
      descKey: "home.explore.journalDesc",
      icon: NotebookPen,
      tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    },
    {
      href: "/backtest",
      titleKey: "home.explore.backtest",
      descKey: "home.explore.backtestDesc",
      icon: FlaskConical,
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    },
    {
      href: "/settings/prop-firm",
      titleKey: "home.explore.prop",
      descKey: "home.explore.propDesc",
      icon: Building2,
      tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    },
    {
      href: "/agents",
      titleKey: "home.explore.agents",
      descKey: "home.explore.agentsDesc",
      icon: Bot,
      tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    },
  ];

  const focus: { href: string; labelKey: MessageKey; icon: typeof LineChart }[] = [
    { href: "/analytics", labelKey: "home.focus.weekly", icon: LineChart },
    { href: "/diary", labelKey: "home.focus.plan", icon: CalendarDays },
    { href: "/trading-plan", labelKey: "home.focus.playbook", icon: ListChecks },
    { href: "/backtest", labelKey: "home.focus.backtest", icon: FlaskConical },
  ];

  const resources: { href: string; labelKey: MessageKey; icon: typeof BookOpen }[] = [
    { href: "/wiki", labelKey: "home.resources.course", icon: BookOpen },
    { href: "/settings/support", labelKey: "home.resources.support", icon: HelpCircle },
    { href: "/news", labelKey: "home.resources.news", icon: Newspaper },
  ];

  function askCoach(e: FormEvent) {
    e.preventDefault();
    const q = query.trim() || t("home.aiPlaceholder");
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="bg-[var(--color-background)]">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-10 px-4 py-10 sm:px-6 lg:py-14">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          {t(greetingKey)}, {name}.
        </h1>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
          <form onSubmit={askCoach} className="flex items-center gap-3">
            <span className="hidden shrink-0 sm:block">
              <Logo size={36} />
            </span>
            <label className="sr-only" htmlFor="home-ai-query">
              {t("home.aiPlaceholder")}
            </label>
            <input
              id="home-ai-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("home.aiPlaceholder")}
              className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-transparent text-[15px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground text-on-accent transition hover:bg-primary-hover"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              {t("home.aiSubmit")}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {prompts.map((p) => (
              <Link
                key={p.labelKey}
                href={p.href}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition hover:border-primary/40 hover:bg-[var(--color-primary-very-light)] hover:text-primary"
              >
                {t(p.labelKey)}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-[var(--color-text-primary)]">{t("home.explore")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className="flex items-start gap-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-primary/30 hover:shadow-sm"
                >
                  <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", p.tone)}>
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-[var(--color-text-primary)]">
                      {t(p.titleKey)}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-5 text-[var(--color-text-secondary)]">
                      {t(p.descKey)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="mb-3 text-[15px] font-semibold text-[var(--color-text-primary)]">{t("home.focus")}</h2>
            <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              {focus.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-3.5 text-[13.5px] font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-primary-very-light)]"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1">{t(item.labelKey)}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold text-[var(--color-text-primary)]">{t("home.resources")}</h2>
            <ul className="space-y-1">
              {resources.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-lg px-1 py-2 text-[13.5px] text-[var(--color-text-secondary)] transition hover:text-primary"
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

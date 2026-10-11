"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";

export type InsightSectionDef = { id: string; label: string };

export function InsightSection({
  id,
  title,
  description,
  hint,
  children,
}: {
  id: string;
  title: string;
  description: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={`insights-${id}`} data-insight-section={id} className="scroll-mt-16 space-y-3">
      <div className="flex flex-col gap-0.5 pt-2">
        <h2 className="flex items-center gap-1 text-[17px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          {title}
          {hint ? <InfoTooltip content={hint} label={title} /> : null}
        </h2>
        <p className="text-[12px] text-[var(--color-text-tertiary)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

export function SectionNav({ sections }: { sections: InsightSectionDef[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [navEl, setNavEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!navEl) return;
    const root = scrollParent(navEl);
    const targets = sections
      .map((s) => document.getElementById(`insights-${s.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.getAttribute("data-insight-section");
          if (!id) continue;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = sections.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      { root, rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [navEl, sections]);

  useEffect(() => {
    const pill = navEl?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!navEl || !pill) return;
    const navBox = navEl.getBoundingClientRect();
    const pillBox = pill.getBoundingClientRect();
    if (pillBox.left >= navBox.left && pillBox.right <= navBox.right) return;
    const left = navEl.scrollLeft + pillBox.left - navBox.left - (navBox.width - pillBox.width) / 2;
    navEl.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  }, [active, navEl, reduce]);

  const go = useCallback(
    (id: string) => {
      setActive(id);
      document.getElementById(`insights-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    },
    [reduce]
  );

  return (
    <nav
      ref={setNavEl}
      aria-label="Insights sections"
      className="-mx-1 flex h-11 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {sections.map((s) => {
        const on = s.id === active;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            aria-current={on ? "true" : undefined}
            className={clsx(
              "relative inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30",
              on ? "text-[var(--color-primary)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {on ? (
              <motion.span
                layoutId="insights-nav-pill"
                className="absolute inset-0 rounded-full border border-primary/20 bg-[var(--color-primary-very-light)]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                aria-hidden
              />
            ) : null}
            <span className="relative">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

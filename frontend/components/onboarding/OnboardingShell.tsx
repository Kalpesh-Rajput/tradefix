"use client";

import clsx from "clsx";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check, ChevronLeft, Loader2, Moon, Star, Sun } from "lucide-react";
import {
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { Logo } from "@/components/ui/Logo";
import { resolveTheme } from "@/lib/appearance";

interface OnboardingShellProps {
  step: number;
  onBack?: () => void;
  children: ReactNode;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function KineticSpotlight() {
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(50);
  const y = useMotionValue(30);
  const sx = useSpring(x, { stiffness: 80, damping: 28 });
  const sy = useSpring(y, { stiffness: 80, damping: 28 });
  const bg = useMotionTemplate`radial-gradient(640px circle at ${sx}% ${sy}%, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.02) 28%, transparent 58%)`;

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: globalThis.MouseEvent) => {
      x.set((e.clientX / window.innerWidth) * 100);
      y.set((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduced, x, y]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div className="absolute inset-0" style={{ background: bg }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.05),_transparent_55%)]" />
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)/0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
        }}
      />
      {!reduced &&
        [0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-primary/40"
            style={{ left: `${12 + i * 18}%`, top: `${18 + (i % 3) * 22}%` }}
            animate={{ y: [0, -18, 0], opacity: [0.12, 0.45, 0.12], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 3.4 + i * 0.45, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
          />
        ))}
    </div>
  );
}

function SegmentProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 6`}>
      {Array.from({ length: 6 }).map((_, i) => {
        const active = i + 1 === step;
        const done = i + 1 < step;
        return (
          <motion.span
            key={i}
            layout
            className={clsx("h-1.5 rounded-full", done || active ? "bg-primary" : "bg-foreground/15")}
            animate={{
              width: active ? 28 : 10,
              opacity: done || active ? 1 : 0.45,
              scaleY: active ? 1.35 : 1,
            }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
          />
        );
      })}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme, saving } = useAppearance();
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(theme, systemDark);
  const isLight = resolved === "light";

  return (
    <motion.button
      type="button"
      disabled={saving}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground/70 transition hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </motion.button>
  );
}

function StarRating() {
  return (
    <div className="flex items-center gap-0.5" aria-label="4.8 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={clsx(
            "flex h-2.5 w-2.5 items-center justify-center rounded-[2px]",
            i < 4 ? "bg-primary" : "bg-gradient-to-r from-primary from-50% to-primary/25 to-50%"
          )}
        >
          <Star className="h-1.5 w-1.5 fill-primary-foreground text-primary-foreground" />
        </span>
      ))}
    </div>
  );
}

function SocialProofFooter() {
  const stats = [
    {
      id: "rated",
      title: "Top Rated by Traders",
      custom: (
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[10px] italic text-muted sm:justify-start">
          <span>800+ Reviews</span>
          <StarRating />
          <span>4.8 stars</span>
        </div>
      ),
    },
    { id: "traders", value: "51,000+", label: "Active Traders" },
    { id: "backtests", value: "200,000+", label: "Backtesting Sessions" },
    { id: "trades", value: "20.5B+", label: "Trades Journaled" },
  ] as const;

  return (
    <footer className="z-20 shrink-0 border-t border-border bg-surface-2/95 px-3 py-1.5 backdrop-blur-md sm:px-6">
      <div className="mx-auto grid max-w-4xl scale-[0.92] grid-cols-2 gap-x-3 gap-y-1.5 sm:scale-100 sm:grid-cols-4 sm:gap-4 origin-bottom">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.id}
            className="text-center sm:text-left"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
          >
            {"title" in stat ? (
              <>
                <p className="text-[11px] font-medium leading-tight text-foreground sm:text-xs">{stat.title}</p>
                {stat.custom}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{stat.value}</p>
                <p className="text-[10px] italic leading-tight text-muted">{stat.label}</p>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </footer>
  );
}

export function OnboardingShell({ step, onBack, children }: OnboardingShellProps) {
  const showProgress = step > 0;

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <KineticSpotlight />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
        <motion.div
          className="flex w-[120px] min-w-0 shrink-0 items-center gap-2 sm:w-[140px]"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Logo size={28} showWordmark />
        </motion.div>

        {showProgress ? (
          <div className="flex flex-1 items-center justify-center gap-3">
            {onBack ? (
              <motion.button
                type="button"
                onClick={onBack}
                whileHover={{ scale: 1.08, rotate: -8 }}
                whileTap={{ scale: 0.92 }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </motion.button>
            ) : (
              <span className="h-9 w-9" />
            )}
            <SegmentProgress step={step} />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex w-[120px] shrink-0 justify-end sm:w-[140px]">
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-1 pt-1 sm:px-8">
        <div className="mx-auto flex h-full w-full max-w-2xl min-h-0 flex-1 flex-col overflow-hidden [perspective:1200px]">
          {children}
        </div>
      </main>

      <SocialProofFooter />
    </div>
  );
}

export function OptionCard({
  selected,
  onClick,
  children,
  className,
  index = 0,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 220, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 220, damping: 18 });
  const glareX = useTransform(mx, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(my, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX}% ${glareY}%, hsl(var(--foreground) / 0.08), transparent 42%)`;
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const onMove = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (reduced || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      mx.set((e.clientX - rect.left) / rect.width - 0.5);
      my.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [mx, my, reduced]
  );

  const onLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const id = Date.now();
      setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 650);
    }
    onClick();
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={handleClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      initial={{ opacity: 0, y: 22, rotateX: -8 }}
      animate={{
        opacity: selected ? 1 : 0.92,
        y: 0,
        rotateX: 0,
        scale: 1,
        z: selected ? 20 : 0,
      }}
      transition={{ delay: 0.04 + index * 0.06, type: "spring", stiffness: 260, damping: 22 }}
      style={
        reduced
          ? undefined
          : {
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
            }
      }
      whileTap={{ scale: 0.97 }}
      className={clsx(
        "group relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left will-change-transform",
        selected
          ? "border-primary/45 bg-primary/[0.06] shadow-[0_8px_28px_-18px_hsl(var(--primary)/0.28)]"
          : "border-border bg-surface hover:border-foreground/20 hover:bg-surface-2",
        className
      )}
    >
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: glare }}
        />
      )}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-primary/15"
          style={{ left: r.x, top: r.y, width: 8, height: 8, x: "-50%", y: "-50%" }}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 28, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
      <div className="relative flex items-center gap-2.5" style={{ transform: "translateZ(18px)" }}>
        <div className="min-w-0 flex-1">{children}</div>
        <motion.span
          initial={false}
          animate={{ scale: selected ? 1 : 0.4, opacity: selected ? 1 : 0, rotate: selected ? 0 : -90 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/15 text-primary"
          aria-hidden
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </motion.span>
      </div>
    </motion.button>
  );
}

export function ContinueButton({
  disabled,
  loading,
  onClick,
  label = "Continue",
}: {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  label?: string;
}) {
  const ready = !disabled && !loading;

  return (
    <motion.button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      layout
      whileHover={ready ? { scale: 1.03 } : undefined}
      whileTap={ready ? { scale: 0.97 } : undefined}
      animate={
        ready
          ? {
              y: [0, -2, 0],
              boxShadow: [
                "0 0 0 0 hsl(var(--primary)/0)",
                "0 10px 36px -8px hsl(var(--primary)/0.4)",
                "0 0 0 0 hsl(var(--primary)/0)",
              ],
            }
          : { y: 0 }
      }
      transition={
        ready
          ? {
              y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
              boxShadow: { duration: 1.8, repeat: Infinity },
            }
          : undefined
      }
      className={clsx(
        "relative mt-3 w-full overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold tracking-wide",
        ready ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-surface-2 text-muted"
      )}
    >
      {ready && (
        <>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.28)_50%,transparent_75%)]"
            animate={{ x: ["-120%", "120%"] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.1, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-2xl border border-foreground/20"
            animate={{ opacity: [0.15, 0.45, 0.15] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        </>
      )}
      <span className="relative inline-flex items-center justify-center gap-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Saving..." : label}
        {ready && !loading && (
          <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
            →
          </motion.span>
        )}
      </span>
    </motion.button>
  );
}

export function KineticTitle({ text, className }: { text: string; className?: string }) {
  return (
    <h1 className={clsx("text-center text-xl font-semibold tracking-tight text-foreground sm:text-2xl", className)}>
      {text.split("").map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: 18, filter: "blur(8px)", rotateX: 60 }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", rotateX: 0 }}
          transition={{ delay: 0.03 + i * 0.018, type: "spring", stiffness: 320, damping: 20 }}
        >
          {ch}
        </motion.span>
      ))}
    </h1>
  );
}

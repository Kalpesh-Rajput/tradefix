"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { MOTION, reducedPreset } from "@/lib/motion";

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DURATION_MS = { success: 4200, info: 4200, warning: 6000, error: 7000 } as const;
/** Identical toasts within this window are merged (double submits, overlapping refetches). */
const DEDUPE_MS = 1500;

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const ACCENT = {
  success: "text-[var(--color-success-text)]",
  error: "text-destructive",
  warning: "text-[var(--color-warning-text)]",
  info: "text-primary",
} as const;

const BAR = {
  success: "bg-[var(--color-success-text)]",
  error: "bg-destructive",
  warning: "bg-[var(--color-warning)]",
  info: "bg-primary",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const recent = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, number>());
  const reduce = useReducedMotion();

  useEffect(() => {
    setMounted(true);
    const pending = timers.current;
    return () => pending.forEach((handle) => window.clearTimeout(handle));
  }, []);

  const dismiss = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle) window.clearTimeout(handle);
    timers.current.delete(id);
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "info" }: { title: string; description?: string; variant?: ToastVariant }) => {
      const key = `${variant}|${title}|${description ?? ""}`;
      const now = Date.now();
      const last = recent.current.get(key);
      if (last && now - last < DEDUPE_MS) return;
      recent.current.set(key, now);

      const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev.slice(-4), { id, title, description, variant }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), DURATION_MS[variant])
      );
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, variant: "success" }),
      error: (title, description) => toast({ title, description, variant: "error" }),
      warning: (title, description) => toast({ title, description, variant: "warning" }),
      info: (title, description) => toast({ title, description, variant: "info" }),
    }),
    [toast]
  );

  const preset = reducedPreset(MOTION.toast, reduce);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-[min(100vw-2rem,360px)] flex-col gap-2">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const Icon = ICONS[item.variant];
                const assertive = item.variant === "error" || item.variant === "warning";
                return (
                  <motion.div
                    key={item.id}
                    layout={!reduce}
                    {...preset}
                    className="tf-toast pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated,var(--color-surface))] py-3 pl-4 pr-3 text-foreground shadow-dropdown"
                    role={assertive ? "alert" : "status"}
                    aria-live={assertive ? "assertive" : "polite"}
                  >
                    <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${BAR[item.variant]}`} />
                    <Icon className={`tf-pop mt-0.5 h-4 w-4 shrink-0 ${ACCENT[item.variant]}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.description && (
                        <p className="mt-0.5 text-xs leading-[1.45] text-muted">{item.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(item.id)}
                      className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

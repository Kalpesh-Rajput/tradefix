"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "success" | "error" | "info";

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
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const STYLES = {
  success: "border-primary/30 bg-surface text-primary",
  error: "border-destructive/40 bg-surface text-destructive",
  info: "border-border bg-surface text-foreground",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "info" }: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev.slice(-4), { id, title, description, variant }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, variant: "success" }),
      error: (title, description) => toast({ title, description, variant: "error" }),
      info: (title, description) => toast({ title, description, variant: "info" }),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,360px)] flex-col gap-2"
            aria-live="polite"
            aria-relevant="additions"
          >
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const Icon = ICONS[item.variant];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className={`pointer-events-auto flex gap-3 rounded-xl border px-3.5 py-3 shadow-lg shadow-black/40 ${STYLES[item.variant]}`}
                    role="status"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-muted">{item.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(item.id)}
                      className="rounded p-0.5 text-muted transition hover:text-foreground"
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

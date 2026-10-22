"use client";

import { AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a red confirm button and a warning icon. */
  tone?: "default" | "danger";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

/** Promise-based replacement for `window.confirm`, rendered with the shared Dialog. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const danger = options?.tone === "danger";

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={open}
        onClose={() => settle(false)}
        size="sm"
        layer="confirm"
        initialFocus="[data-confirm-cancel]"
        title={
          <span className="flex items-center gap-2">
            {danger ? (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              </span>
            ) : null}
            {options?.title}
          </span>
        }
        description={options?.description}
        footer={
          <>
            <Button variant="ghost" size="sm" data-confirm-cancel onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              data-testid="confirm-dialog-accept"
              className={danger ? "!bg-destructive !text-[var(--color-text-inverse)] hover:!bg-destructive/90" : undefined}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

"use client";

import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { APP_HOME, parentPath } from "@/lib/nav";

const MAX_STACK = 40;

type AppNavigationValue = {
  canGoBack: boolean;
  goBack: () => void;
};

const AppNavigationContext = createContext<AppNavigationValue | null>(null);

export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || APP_HOME;
  const router = useRouter();
  const stackRef = useRef<string[]>([pathname]);
  const reversingRef = useRef(false);

  const stack = stackRef.current;
  const last = stack[stack.length - 1];
  if (last !== pathname) {
    const returningToPrevious = reversingRef.current || stack[stack.length - 2] === pathname;
    reversingRef.current = false;
    if (returningToPrevious) {
      if (stack.length > 1) stack.pop();
      if (stack[stack.length - 1] !== pathname) {
        stackRef.current = [pathname];
      }
    } else {
      stack.push(pathname);
      if (stack.length > MAX_STACK) stack.shift();
    }
  }

  const canGoBack = stackRef.current.length > 1 || parentPath(pathname) != null;

  const goBack = useCallback(() => {
    const current = stackRef.current;
    if (current.length > 1) {
      reversingRef.current = true;
      router.push(current[current.length - 2]);
      return;
    }
    const fallback = parentPath(pathname);
    if (fallback && fallback !== pathname) {
      reversingRef.current = true;
      router.push(fallback);
    }
  }, [pathname, router]);

  const value = useMemo(() => ({ canGoBack, goBack }), [canGoBack, goBack]);

  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>;
}

export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) throw new Error("useAppNavigation must be used within AppNavigationProvider");
  return ctx;
}

export function BackButton({ className }: { className?: string }) {
  const { t } = useLocale();
  const { canGoBack, goBack } = useAppNavigation();

  return (
    <button
      type="button"
      onClick={goBack}
      disabled={!canGoBack}
      className={clsx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      aria-label={t("common.back")}
      title={t("common.back")}
      data-testid="app-back"
    >
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" strokeWidth={2} />
    </button>
  );
}

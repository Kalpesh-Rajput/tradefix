"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type HeaderSlot = {
  actions: ReactNode;
  subtitle: ReactNode;
};

type HeaderActionsContextValue = {
  actions: ReactNode;
  subtitle: ReactNode;
  setSlot: (slot: HeaderSlot) => void;
};

const EMPTY_SLOT: HeaderSlot = { actions: null, subtitle: null };

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null);

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HeaderSlot>(EMPTY_SLOT);
  const value = useMemo(
    () => ({ actions: slot.actions, subtitle: slot.subtitle, setSlot }),
    [slot]
  );
  return <HeaderActionsContext.Provider value={value}>{children}</HeaderActionsContext.Provider>;
}

export function useHeaderActionsSlot() {
  const ctx = useContext(HeaderActionsContext);
  if (!ctx) throw new Error("useHeaderActionsSlot must be used within HeaderActionsProvider");
  return ctx;
}

/** Renders page-specific controls (and optional subtitle) in the shared AppHeader. */
export function HeaderActions({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
}) {
  const { setSlot } = useHeaderActionsSlot();

  useLayoutEffect(() => {
    setSlot({ actions: children, subtitle: subtitle ?? null });
    return () => setSlot(EMPTY_SLOT);
  }, [children, subtitle, setSlot]);

  return null;
}

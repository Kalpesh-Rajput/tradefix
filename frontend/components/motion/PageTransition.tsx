"use client";

import clsx from "clsx";
import { usePathname } from "next/navigation";

import { pageTransitionKey } from "@/lib/motion";

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname() || "/";

  return (
    <div key={pageTransitionKey(pathname)} className={clsx("page-enter", className)}>
      {children}
    </div>
  );
}

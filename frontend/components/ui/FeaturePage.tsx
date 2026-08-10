"use client";

import type { ReactNode } from "react";

export function FeaturePage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </div>
  );
}

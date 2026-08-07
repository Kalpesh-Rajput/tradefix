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
        <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </div>
  );
}

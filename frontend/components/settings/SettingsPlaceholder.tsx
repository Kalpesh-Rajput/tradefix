"use client";

import type { ReactNode } from "react";

import { SettingsCard, SettingsPageHeader, SettingsShell } from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";

export function SettingsPlaceholder({
  title,
  subtitle,
  cardTitle,
  children,
}: {
  title: string;
  subtitle: string;
  cardTitle: string;
  children: ReactNode;
}) {
  return (
    <SettingsShell>
      <SettingsPageHeader title={title} subtitle={subtitle} />
      <SettingsCard title={cardTitle}>{children}</SettingsCard>
    </SettingsShell>
  );
}

export function ComingFeature({
  title,
  body,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  cta?: string;
  onClick?: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="text-sm leading-relaxed text-zinc-500">{body}</p>
      {cta && (
        <Button type="button" variant="secondary" onClick={onClick}>
          {cta}
        </Button>
      )}
    </div>
  );
}

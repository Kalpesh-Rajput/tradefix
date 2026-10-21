import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function HubPanel({ title, subtitle, action, children }: Props) {
  return (
    <section className="dash-card overflow-hidden p-0 shadow-card-md">
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

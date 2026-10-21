import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
};

export function HubEmpty({ icon: Icon, title, body, action }: Props) {
  return (
    <div className="dash-card relative overflow-hidden px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.10),transparent)]"
      />
      <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.45)]">
        <Icon className="h-6 w-6" strokeWidth={1.6} aria-hidden />
      </span>
      <p className="relative mt-5 text-base font-semibold tracking-tight text-foreground">{title}</p>
      <p className="relative mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="relative mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

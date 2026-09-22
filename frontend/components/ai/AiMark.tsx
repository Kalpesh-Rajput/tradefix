"use client";

import clsx from "clsx";
import { Sparkles } from "lucide-react";

export function AiMark({
  size = 32,
  pulse = false,
  className,
}: {
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
  const icon = Math.max(12, Math.round(size * 0.46));
  return (
    <span
      className={clsx(
        "ai-orb inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c6bb3] to-[#5b4696] text-white text-on-accent",
        pulse && "ai-orb-pulse",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Sparkles className="ai-sparkle" width={icon} height={icon} strokeWidth={2} />
    </span>
  );
}

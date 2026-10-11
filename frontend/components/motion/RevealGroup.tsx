import { Children, isValidElement, type ReactNode } from "react";
import clsx from "clsx";

import { REVEAL_STAGGER_CAP, REVEAL_STAGGER_MS } from "@/lib/motion";

export function RevealGroup({
  children,
  className,
  itemClassName,
  animate = true,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  animate?: boolean;
}) {
  const items = Children.toArray(children);

  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {items.map((child, index) => {
        const key = isValidElement(child) && child.key != null ? String(child.key) : index;
        const delay = Math.min(index, REVEAL_STAGGER_CAP) * REVEAL_STAGGER_MS;
        return (
          <div
            key={key}
            className={clsx("reveal-item min-w-0", itemClassName)}
            style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}

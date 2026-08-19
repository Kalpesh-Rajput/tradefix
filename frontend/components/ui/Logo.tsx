import Image from "next/image";
import clsx from "clsx";

/**
 * TradeFix brand mark — circular badge from /public/logo.png.
 * Optional wordmark text matches the purple “Fix” lockup.
 */
export function Logo({
  size = 36,
  showWordmark = false,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="TradeFix"
        width={size}
        height={size}
        className="shrink-0 rounded-full object-contain"
        priority
      />
      {showWordmark && (
        <span
          className={clsx(
            "font-semibold tracking-tight text-foreground",
            size >= 40 ? "text-base" : "text-[15px]"
          )}
        >
          Trade
          <span className="bg-gradient-to-r from-[#A78BFA] to-[#7C5CBF] bg-clip-text text-transparent">
            Fix
          </span>
        </span>
      )}
    </div>
  );
}

/** Sidebar lockup — circular logo + TradeFix text (same size as before). */
export function BrandLockup({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt="TradeFix"
        width={collapsed ? 36 : 32}
        height={collapsed ? 36 : 32}
        className={clsx("shrink-0 rounded-full object-contain", collapsed ? "h-9 w-9" : "h-8 w-8")}
        priority
      />
      {!collapsed && (
        <span className="text-[18px] font-bold leading-none tracking-tight text-white">
          Trade
          <span className="bg-gradient-to-r from-[#A78BFA] to-[#7C5CBF] bg-clip-text text-transparent">
            Fix
          </span>
        </span>
      )}
    </div>
  );
}

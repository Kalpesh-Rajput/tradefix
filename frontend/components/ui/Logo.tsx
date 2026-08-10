import Image from "next/image";
import clsx from "clsx";

/**
 * TradeFix brand mark — circular PNG from /public/logo.png (transparent outside the disc).
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
        className="shrink-0 object-contain"
        priority
      />
      {showWordmark && (
        <span
          className={clsx(
            "font-semibold tracking-tight text-foreground",
            size >= 40 ? "text-base" : "text-[15px]"
          )}
        >
          Trade<span className="text-accent">Fix</span>
        </span>
      )}
    </div>
  );
}

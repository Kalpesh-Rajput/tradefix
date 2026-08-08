import Image from "next/image";

/**
 * TradeFix brand mark — circular logo from /public/logo.png.
 */
export function Logo({ size = 36, showWordmark = false }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="TradeFix"
        width={size}
        height={size}
        className="shrink-0 rounded-full"
        priority
      />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          trade<span className="text-accent">fix</span>
        </span>
      )}
    </div>
  );
}

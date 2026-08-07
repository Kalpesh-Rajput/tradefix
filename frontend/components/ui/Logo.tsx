import clsx from "clsx";

/**
 * TradeFix mark — emerald ring + monogram. Swap for /public/logo.png when ready.
 */
export function Logo({ size = 36, showWordmark = false }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-accent bg-black shadow-glow"
        style={{ width: size, height: size }}
      >
        <span className="font-sans font-bold text-accent" style={{ fontSize: size * 0.42 }}>
          TF
        </span>
      </div>
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-white">
          trade<span className="text-accent">fix</span>
        </span>
      )}
    </div>
  );
}

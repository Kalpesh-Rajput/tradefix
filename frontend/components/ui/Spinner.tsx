import clsx from "clsx";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={clsx(
        "tf-spinner inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-r-transparent",
        className
      )}
    />
  );
}

"use client";

import clsx from "clsx";
import { UserRound } from "lucide-react";
import { useState } from "react";

import { avatarColors, avatarInitials, resolveAvatarSize, type AvatarSize } from "@/lib/avatar";

type AvatarRing = "none" | "accent" | "active";

/**
 * Shared user avatar: photo, then deterministic initials, then a user icon.
 * A failed image is remembered per `src`, so it is never requested twice.
 */
export function Avatar({
  src,
  name,
  email,
  size = "sm",
  ring = "none",
  loading = false,
  decorative = true,
  className,
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: AvatarSize | number;
  ring?: AvatarRing;
  loading?: boolean;
  /** When false, the avatar is announced with the user's name. */
  decorative?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const px = resolveAvatarSize(size);
  const showImage = Boolean(src) && failedSrc !== src;
  const imageReady = showImage && loadedSrc === src;
  const initials = avatarInitials(name, email);
  const colors = avatarColors(name, email);
  const label = (name || email || "User").trim();

  const frame = clsx(
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)]",
    "transition-[box-shadow,border-color] duration-base ease-out-expo motion-reduce:transition-none",
    ring === "accent" && "ring-2 ring-[color-mix(in_srgb,var(--color-primary)_35%,transparent)]",
    ring === "active" && "ring-2 ring-[var(--color-primary)]",
    className
  );

  if (loading) {
    return <span aria-hidden className={clsx(frame, "animate-pulse bg-foreground/[0.08]")} style={{ width: px, height: px }} />;
  }

  return (
    <span
      className={frame}
      style={{
        width: px,
        height: px,
        fontSize: Math.max(10, Math.round(px * 0.38)),
        backgroundImage: showImage ? undefined : `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
        backgroundColor: showImage ? "var(--color-surface)" : undefined,
      }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          width={px}
          height={px}
          decoding="async"
          draggable={false}
          ref={(node) => {
            if (node?.complete && node.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src!);
          }}
          onLoad={() => setLoadedSrc(src!)}
          onError={() => setFailedSrc(src!)}
          className={clsx(
            "h-full w-full object-cover transition-opacity duration-base motion-reduce:transition-none",
            imageReady ? "opacity-100" : "opacity-0"
          )}
        />
      ) : initials ? (
        <span aria-hidden className="font-semibold leading-none tracking-wide text-white">
          {initials}
        </span>
      ) : (
        <UserRound aria-hidden strokeWidth={1.75} className="text-white/90" style={{ width: px * 0.55, height: px * 0.55 }} />
      )}
    </span>
  );
}

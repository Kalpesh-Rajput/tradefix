"use client";

import clsx from "clsx";
import { useState } from "react";

import { brokerAccentClass, brokerIconUrl, brokerInitials } from "@/lib/brokers";

export function BrokerIcon({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const url = brokerIconUrl(name);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(url) && !failed;

  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        !showImage && brokerAccentClass(name),
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[9px] font-bold leading-none">{brokerInitials(name)}</span>
      )}
    </span>
  );
}

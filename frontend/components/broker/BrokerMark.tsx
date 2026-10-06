"use client";

import { Layers } from "lucide-react";
import { useState } from "react";

import { providerLogoUrl, type BrokerProvider } from "@/lib/brokers/provider";

export function BrokerMark({
  provider,
  size = 36,
}: {
  provider: Pick<BrokerProvider, "id" | "display_name" | "logo">;
  size?: number;
}) {
  const url = providerLogoUrl(provider);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(url) && !failed;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2"
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt={`${provider.display_name} logo`}
          width={size}
          height={size}
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <Layers className="text-muted" style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden />
      )}
    </span>
  );
}

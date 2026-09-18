"use client";

import clsx from "clsx";
import { useMemo } from "react";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { getMarketTimeZoneOptions } from "@/lib/market-sessions/timezone";

export function TimezonePicker({
  value,
  onChange,
  at,
  localTimeZone,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  at: Date;
  localTimeZone?: string;
  className?: string;
}) {
  const hourKey = Math.floor(at.getTime() / 3_600_000);
  const options = useMemo(
    () => getMarketTimeZoneOptions(new Date(hourKey * 3_600_000), localTimeZone),
    [hourKey, localTimeZone]
  );

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      searchPlaceholder="Search timezones…"
      placeholder="Select timezone"
      aria-label="Timezone"
      className={clsx("w-full min-w-0 sm:w-[min(100%,360px)]", className)}
      triggerClassName="h-8 rounded-md py-0 text-[12px]"
    />
  );
}

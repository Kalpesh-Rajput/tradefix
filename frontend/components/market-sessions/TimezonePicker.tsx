"use client";

import { useMemo } from "react";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { getMarketTimeZoneOptions } from "@/lib/market-sessions/timezone";

export function TimezonePicker({
  value,
  onChange,
  at,
  localTimeZone,
}: {
  value: string;
  onChange: (value: string) => void;
  at: Date;
  localTimeZone?: string;
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
      className="w-[min(100%,320px)]"
      triggerClassName="h-8 rounded-md py-0 text-[12px]"
    />
  );
}

"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { Input, Select } from "@/components/ui/Input";
import { TradeFilters as Filters } from "@/lib/hooks/useTrades";

export function TradeFilters({ value, onChange }: { value: Filters; onChange: (v: Filters) => void }) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-40">
        <Input
          placeholder={t("common.symbol")}
          value={value.symbol ?? ""}
          onChange={(e) => onChange({ ...value, symbol: e.target.value || undefined })}
        />
      </div>
      <div className="w-48">
        <Input
          placeholder={t("journal.setupTag")}
          value={value.setup_tag ?? ""}
          onChange={(e) => onChange({ ...value, setup_tag: e.target.value || undefined })}
        />
      </div>
      <div className="w-36">
        <Select
          value={value.status ?? ""}
          onChange={(e) => onChange({ ...value, status: e.target.value || undefined })}
        >
          <option value="">{t("journal.allStatuses")}</option>
          <option value="open">{t("common.open")}</option>
          <option value="closed">{t("common.closed")}</option>
        </Select>
      </div>
    </div>
  );
}

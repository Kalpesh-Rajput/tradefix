import { Input, Select } from "@/components/ui/Input";
import { TradeFilters as Filters } from "@/lib/hooks/useTrades";

export function TradeFilters({ value, onChange }: { value: Filters; onChange: (v: Filters) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-40">
        <Input
          placeholder="Symbol"
          value={value.symbol ?? ""}
          onChange={(e) => onChange({ ...value, symbol: e.target.value || undefined })}
        />
      </div>
      <div className="w-48">
        <Input
          placeholder="Setup tag"
          value={value.setup_tag ?? ""}
          onChange={(e) => onChange({ ...value, setup_tag: e.target.value || undefined })}
        />
      </div>
      <div className="w-36">
        <Select
          value={value.status ?? ""}
          onChange={(e) => onChange({ ...value, status: e.target.value || undefined })}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </Select>
      </div>
    </div>
  );
}

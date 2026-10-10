const REQUIRED_COLUMNS = [
  { name: "Symbol", hint: "Ticker or pair", example: "EURUSD" },
  { name: "Side", hint: "Buy or Sell", example: "Buy" },
  { name: "Quantity", hint: "Size or lots", example: "0.10" },
  { name: "Entry price", hint: "Open price", example: "1.1000" },
  { name: "Open time", hint: "Date and time", example: "2024-01-02 10:00" },
] as const;

const OPTIONAL_COLUMNS = [
  { name: "Exit price", hint: "Close price", example: "1.1050" },
  { name: "Close time", hint: "Date and time", example: "2024-01-02 12:00" },
  { name: "Commission", hint: "Broker fee", example: "1.25" },
  { name: "Ticket", hint: "Order or deal id", example: "1001" },
  { name: "Notes", hint: "Journal note", example: "Waited for London" },
  { name: "Emotions", hint: "How it felt", example: "FOMO" },
  { name: "Strategy", hint: "Playbook name", example: "Breakout" },
  { name: "P&L", hint: "Profit or loss", example: "25.50" },
] as const;

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const HEADER_LINE = ALL_COLUMNS.map((column) => column.name).join(", ");

export function FileColumnSheet({ variant = "card" }: { variant?: "card" | "strip" }) {
  if (variant === "strip") {
    return (
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">5 required columns</p>
          <p className="text-[11px] text-muted">Header on the first row. Any order.</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5">
          {REQUIRED_COLUMNS.map((column) => (
            <div key={column.name} className="bg-card px-3 py-2.5">
              <p className="text-[11px] font-semibold text-primary">{column.name}</p>
              <p className="mt-1 font-mono text-xs text-foreground">{column.example}</p>
              <p className="mt-0.5 text-[10px] text-muted">{column.hint}</p>
            </div>
          ))}
        </div>
        <p className="mb-2 mt-3 text-[11px] font-semibold text-foreground">Optional columns</p>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {OPTIONAL_COLUMNS.map((column) => (
            <div key={column.name} className="bg-card px-3 py-2.5">
              <p className="text-[11px] font-semibold text-foreground">{column.name}</p>
              <p className="mt-1 font-mono text-xs text-foreground">{column.example}</p>
              <p className="mt-0.5 text-[10px] text-muted">{column.hint}</p>
            </div>
          ))}
        </div>
        <SheetDescription />
      </div>
    );
  }

  return (
    <div className="mt-3 flex grow flex-col rounded-lg border border-primary/20 bg-card/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">5 required columns</p>
        <p className="text-[10px] text-muted">Any order</p>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {REQUIRED_COLUMNS.map((column, index) => (
          <ColumnRow key={column.name} index={index + 1} column={column} />
        ))}
      </ul>
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Optional columns</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {OPTIONAL_COLUMNS.map((column, index) => (
          <ColumnRow key={column.name} index={REQUIRED_COLUMNS.length + index + 1} column={column} quiet />
        ))}
      </ul>
      <SheetDescription />
    </div>
  );
}

function ColumnRow({
  index,
  column,
  quiet = false,
}: {
  index: number;
  column: { name: string; hint: string; example: string };
  quiet?: boolean;
}) {
  return (
    <li
      className={
        quiet
          ? "grid grid-cols-[1rem_5.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-foreground/[0.03] px-2 py-1.5"
          : "grid grid-cols-[1rem_5.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-primary/[0.05] px-2 py-1.5"
      }
    >
      <span className={quiet ? "text-[10px] font-semibold text-muted" : "text-[10px] font-semibold text-primary"}>
        {index}
      </span>
      <span className="truncate text-xs font-medium text-foreground">{column.name}</span>
      <span className="truncate text-[10px] text-muted">{column.hint}</span>
      <span className="whitespace-nowrap font-mono text-[10px] text-foreground">{column.example}</span>
    </li>
  );
}

function SheetDescription() {
  return (
    <p className="mt-2.5 text-[10px] leading-relaxed text-muted">
      First row, any order: {HEADER_LINE}. A closing sell can leave Entry price and Open time blank. Ticker, Qty,
      Price, and Date work too. Stop loss, session, mood, and the other journal columns are matched when the file
      includes them. CSV, Excel, or XML.
    </p>
  );
}

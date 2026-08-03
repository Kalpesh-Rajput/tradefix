export function fmtMoney(n: number, opts?: { signed?: boolean; digits?: number }) {
  const signed = opts?.signed ?? true;
  const digits = opts?.digits ?? 2;
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (!signed) return `$${abs}`;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${abs}`;
}

export function fmtPct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function firstName(name?: string | null, email?: string | null) {
  if (name?.trim()) return name.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "Trader";
}

export function todayLabel(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** SuperTrader-style: "FRIDAY, JULY 31" */
export function todayLabelShort(d = new Date()) {
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

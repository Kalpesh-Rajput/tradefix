import { parseLocalIso } from "@/lib/dateLocal";

export function formatNoteTitle(iso: string, locale: string) {
  return parseLocalIso(iso).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatNumericDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}

export function formatNoteStamp(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function notePreview(text: string | null | undefined) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Screenshots only";
  return clean.length > 72 ? `${clean.slice(0, 72)}…` : clean;
}

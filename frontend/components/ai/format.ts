import type { AiSource } from "@/lib/types";

export type StatChip = { label: string; value: string };

const SECTION_NAMES = {
  summary: "summary",
  "what the data shows": "shows",
  pattern: "pattern",
  evidence: "evidence",
  "suggested reflection": "reflection",
} as const;

type SectionKey = (typeof SECTION_NAMES)[keyof typeof SECTION_NAMES];

export type ShapedAnswer = {
  kind: "briefing" | "prose";
  stats: StatChip[];
  paragraphs: string[];
  reflection: string[];
};

function sectionName(line: string): SectionKey | null {
  const text = line
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
  return text in SECTION_NAMES ? SECTION_NAMES[text as keyof typeof SECTION_NAMES] : null;
}

function stripMarks(line: string): string {
  return line.replace(/\*\*/g, "").replace(/^[-*•]\s+/, "").trim();
}

function factLine(line: string): StatChip | null {
  const plain = stripMarks(line);
  const match = plain.match(/^([^:]{2,64}):\s*(.+)$/);
  if (!match) return null;
  const label = match[1].trim();
  const value = match[2].trim();
  if (!value || value.length > 48 || !/(\$|%|\d)/.test(value)) return null;
  if (sectionName(label)) return null;
  return { label, value };
}

export function shapeAnswer(text: string): ShapedAnswer {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const groups: Record<"lead" | SectionKey, string[]> = {
    lead: [],
    summary: [],
    shows: [],
    pattern: [],
    evidence: [],
    reflection: [],
  };
  let bucket: "lead" | SectionKey = "lead";
  let sawSection = false;

  for (const raw of lines) {
    const name = sectionName(raw);
    if (name) {
      sawSection = true;
      bucket = name;
      continue;
    }
    if (raw.trim()) groups[bucket].push(raw.trim());
  }

  const stats: StatChip[] = [];
  const statKeys = new Set<string>();

  function pushStat(line: string) {
    const fact = factLine(line);
    if (!fact) return false;
    const key = fact.label.toLowerCase();
    if (!statKeys.has(key) && stats.length < 4) {
      statKeys.add(key);
      stats.push(fact);
    }
    return true;
  }

  const paragraphs: string[] = [];
  const seenPara = new Set<string>();

  function pushParagraph(line: string) {
    const cleaned = stripMarks(line);
    const key = cleaned.toLowerCase();
    if (!cleaned || seenPara.has(key) || sectionName(cleaned)) return;
    seenPara.add(key);
    paragraphs.push(cleaned);
  }

  const reflection: string[] = [];
  const seenRef = new Set<string>();

  function pushReflection(line: string) {
    const item = stripMarks(line);
    const key = item.toLowerCase();
    if (!item || seenRef.has(key) || reflection.length >= 3) return;
    seenRef.add(key);
    reflection.push(item);
  }

  function take(linesIn: string[]) {
    for (const line of linesIn) {
      if (pushStat(line)) continue;
      if (/^[-*•]\s+/.test(line)) {
        pushReflection(line);
        continue;
      }
      pushParagraph(line);
    }
  }

  take(groups.summary);
  take(groups.lead);
  take(groups.shows);
  take(groups.pattern);
  take(groups.evidence);
  take(groups.reflection);

  if (!sawSection && stats.length < 2) {
    return { kind: "prose", stats: [], paragraphs: [], reflection: [] };
  }

  return { kind: "briefing", stats, paragraphs, reflection };
}

export function answerPlainText(text: string): string {
  const shaped = shapeAnswer(text);
  if (shaped.kind === "prose") return text.trim();
  return [...shaped.stats.map((item) => `${item.label}: ${item.value}`), ...shaped.paragraphs, ...shaped.reflection]
    .filter(Boolean)
    .join("\n");
}

export type StatKind = "pnl" | "loss" | "win" | "count" | "average" | "general";

export function statKind(label: string): StatKind {
  const text = label.toLowerCase();
  if (/loss|losing|drawdown/.test(text)) return "loss";
  if (/p&l|pnl|profit|gain/.test(text)) return "pnl";
  if (/win/.test(text)) return "win";
  if (/avg|average/.test(text)) return "average";
  if (/count|trades|number/.test(text)) return "count";
  return "general";
}

export function valueTone(value: string): "up" | "down" | "neutral" {
  const token = value.trim();
  if (/^[+＋]/.test(token)) return "up";
  if (/^[-–−]/.test(token)) return "down";
  return "neutral";
}

export function extractStats(text: string): StatChip[] {
  const chips: StatChip[] = [];
  const seen = new Set<string>();

  function add(label: string, value: string) {
    const key = label.toLowerCase();
    if (seen.has(key) || chips.length >= 4) return;
    seen.add(key);
    chips.push({ label, value });
  }

  const trades = text.match(/\b(\d{1,4})\s+closed\s+trades?\b/i) || text.match(/\b(\d{1,4})\s+trades?\b/i);
  if (trades) add("Trades", trades[1]);

  const winRate =
    text.match(/win\s*rate[^%\d]{0,24}(\d{1,3}(?:\.\d+)?)\s*%/i) ||
    text.match(/(\d{1,3}(?:\.\d+)?)\s*%[^.\n]{0,20}win\s*rate/i);
  if (winRate) add("Win rate", `${winRate[1]}%`);

  const expectancy =
    text.match(/expectancy[^$\d-]{0,24}(-?\$?\d[\d,]*(?:\.\d+)?)/i) ||
    text.match(/(-?\$\d[\d,]*(?:\.\d+)?)[^.\n]{0,16}expectancy/i);
  if (expectancy) add("Expectancy", expectancy[1]);

  const avgR =
    text.match(/(?:avg(?:erage)?\s+(?:winner|r(?:-multiple)?))[^0-9]{0,16}(\d+(?:\.\d+)?)\s*R\b/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*R\b[^.\n]{0,20}avg(?:erage)?\s+winner/i);
  if (avgR) add("Avg winner", `${avgR[1]}R`);

  const pf = text.match(/profit\s*factor[^0-9]{0,16}(\d+(?:\.\d+)?)/i);
  if (pf) add("Profit factor", pf[1]);

  return chips;
}

export function sourceHref(source: AiSource): string | null {
  const type = source.type.toLowerCase();
  if (type === "web" && source.url && /^https:\/\//i.test(source.url)) return source.url;
  const date = source.date?.slice(0, 10);

  if (type === "trade_note" && source.id) return `/trades/${source.id}`;
  if (type === "playbook" && source.id) return `/playbooks/${source.id}`;
  if (type === "day_note" && date) return `/notebook?folder=daily&date=${date}`;
  if (type === "daily_recap" && date) return `/notebook?folder=recaps&date=${date}`;
  if (type === "daily_checkin" && date) return `/my-day?date=${date}`;
  if (type === "mood_checkin") return "/mindset";
  return null;
}

export function sourceLabel(source: AiSource): string {
  const type = source.type.toLowerCase();
  const date = source.date?.slice(0, 10);
  const title = source.title?.trim();
  const dated =
    date && ["day_note", "daily_recap", "daily_checkin"].includes(type)
      ? formatShortDate(date)
      : null;

  let base = title;
  if (!base || GENERIC_TITLES.has(title.toLowerCase())) {
    switch (type) {
      case "trade_note":
        base = "Trade";
        break;
      case "trade_comment":
        base = "Trade comment";
        break;
      case "playbook":
        base = "Playbook";
        break;
      case "day_note":
        base = "Journal";
        break;
      case "daily_recap":
        base = "Daily recap";
        break;
      case "daily_checkin":
        base = "Daily check-in";
        break;
      case "mood_checkin":
        base = "Mood check-in";
        break;
      default:
        base = title || "Source";
    }
  }

  if (dated && !base.includes(dated) && !base.includes(date!)) return `${base} — ${dated}`;
  return base;
}

const GENERIC_TITLES = new Set([
  "day_note",
  "daily_recap",
  "daily_checkin",
  "mood_checkin",
  "trade_note",
  "trade_comment",
  "playbook",
]);

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

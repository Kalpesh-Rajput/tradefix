export type NoteSectionKind = "list" | "log";

export type NoteTemplateSection = {
  id: string;
  title: string;
  kind: NoteSectionKind;
  hint?: string;
  items?: string[];
};

export type NoteTemplate = {
  id: string;
  name: string;
  description: string;
  order: number;
  isDefault?: boolean;
  sections: NoteTemplateSection[];
};

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "day-journal",
    name: "Day journal",
    description: "Preparation, session log, and EOD recap",
    order: 1,
    isDefault: true,
    sections: [
      {
        id: "preparation",
        title: "🎯 Preparation & Game plan",
        kind: "list",
        items: ["Watchlist", "Economic events", "Daily/Weekly Bias", "Levels to Watch", "Gameplan"],
      },
      {
        id: "session-log",
        title: "📝 Session log",
        kind: "log",
        hint: "Log your thoughts with timestamps for future recaps. Use voice-to-text to help you.",
      },
      {
        id: "eod",
        title: "📊 EOD PERFORMANCE RECAP",
        kind: "list",
        items: ["Overall Day Recap", 'The "Plus/Minus"'],
      },
    ],
  },
  {
    id: "preparation-game-plan",
    name: "Preparation & Game Plan",
    description: "Watchlist, events, bias, levels, and gameplan",
    order: 2,
    sections: [
      {
        id: "preparation",
        title: "🎯 Preparation & Game plan",
        kind: "list",
        items: ["Watchlist", "Economic events", "Daily/Weekly Bias", "Levels to Watch", "Gameplan"],
      },
    ],
  },
  {
    id: "session-log",
    name: "Session Log",
    description: "Timestamped thoughts during the session",
    order: 3,
    sections: [
      {
        id: "session-log",
        title: "📝 Session log",
        kind: "log",
        hint: "Log your thoughts with timestamps for future recaps. Use voice-to-text to help you.",
      },
    ],
  },
  {
    id: "eod-performance-recap",
    name: "EOD Performance Recap",
    description: "End-of-day recap and plus/minus",
    order: 4,
    sections: [
      {
        id: "eod",
        title: "📊 EOD PERFORMANCE RECAP",
        kind: "list",
        items: ["Overall Day Recap", 'The "Plus/Minus"'],
      },
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = "day-journal";

export function getNoteTemplate(id: string | null | undefined): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? NOTE_TEMPLATES.find((t) => t.isDefault) ?? NOTE_TEMPLATES[0];
}

function renderSection(section: NoteTemplateSection): string {
  if (section.kind === "log") {
    return `<section class="tf-note-section" data-section="${section.id}">
<h2>${escapeHtml(section.title)}</h2>
<div class="tf-note-body">
<p class="tf-note-hint">${escapeHtml(section.hint ?? "")}</p>
<p class="tf-note-log"><br></p>
</div>
</section>`;
  }
  const items = (section.items ?? []).map((item) => `<p>▸ ${escapeHtml(item)}</p>`).join("\n");
  return `<section class="tf-note-section" data-section="${section.id}">
<h2>${escapeHtml(section.title)}</h2>
<div class="tf-note-body">
${items}
</div>
</section>`;
}

export function renderTemplateHtml(template: NoteTemplate): string {
  return template.sections.map(renderSection).join("\n<hr>\n");
}

export function defaultNoteHtml(): string {
  return renderTemplateHtml(getNoteTemplate(DEFAULT_TEMPLATE_ID));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isNoteContentEmpty(html: string): boolean {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

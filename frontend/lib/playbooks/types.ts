export type PlaybookCategoryId = "scalping" | "intraday" | "swing" | "scaling";

export const PLAYBOOK_CATEGORIES: { id: PlaybookCategoryId; label: string }[] = [
  { id: "scalping", label: "Scalping" },
  { id: "intraday", label: "Intraday" },
  { id: "swing", label: "Swing trading" },
  { id: "scaling", label: "Scaling" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PLAYBOOK_CATEGORIES.map((c) => [c.id, c.label])
);

export type PlaybookRules = {
  style?: string;
  entry?: string[];
  confirmation?: string[];
  risk?: string[];
  exit?: string[];
  notes?: string;
};

export type PlaybookChecklistItem = {
  id: string;
  label: string;
};

export type PlaybookTemplate = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  preview_image: string | null;
  categories: string[];
  tags: string[];
  creator_name: string;
  version: number;
  is_system: boolean;
  is_featured: boolean;
  status: string;
  sort_order: number;
  rules: PlaybookRules;
  checklist: PlaybookChecklistItem[];
  created_at: string;
  updated_at: string;
};

export type UserPlaybook = {
  id: string;
  name: string;
  description: string;
  icon: string;
  preview_image: string | null;
  categories: string[];
  tags: string[];
  source_template_id: string | null;
  source_template_slug: string | null;
  source_template_version: number | null;
  rules: PlaybookRules;
  checklist: PlaybookChecklistItem[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type PlaybookCreateInput = {
  name: string;
  description?: string;
  icon?: string;
  categories?: string[];
  tags?: string[];
  rules?: PlaybookRules;
  checklist?: { label: string }[];
};

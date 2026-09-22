export const JOURNAL_QUICK_ACTIONS = [
  { id: "recent", label: "Analyse my recent trades", question: "Analyse my recent trades" },
  { id: "losing", label: "Find my biggest losing pattern", question: "Find my biggest losing pattern" },
  { id: "setups", label: "Compare my setups", question: "Compare my setups" },
  { id: "rules", label: "Check my trades against my rules", question: "Check my trades against my rules" },
  { id: "profitable", label: "Find my most profitable setup", question: "Find my most profitable setup" },
  { id: "summary", label: "Summarize my recent performance", question: "Summarize my recent performance" },
] as const;

export const JOURNAL_ROTATING_PROMPTS = [
  "Where am I losing money?",
  "Analyse my recent trades",
  "Find my most profitable setup",
  "Compare my strategies",
  "What is hurting my performance?",
  "Find my worst trading pattern",
  "Check my rule violations",
] as const;

export type JournalTakeAction = {
  id: string;
  label: string;
  question?: string;
  href?: string;
};

/** Coach questions use the existing chat API. Playbooks is the existing place to define a setup rule. */
export const JOURNAL_TAKE_ACTIONS: JournalTakeAction[] = [
  {
    id: "tag",
    label: "Tag my last 20 trades by setup",
    question: "Review my last 20 trades and group them by setup.",
  },
  {
    id: "flag",
    label: "Find and flag my worst pattern",
    question: "Find my worst trading pattern.",
  },
  {
    id: "playbook",
    label: "Check my last trades against my playbook",
    question: "Check my last trades against my playbook.",
  },
  {
    id: "rule",
    label: "Add a rule to block my worst setup",
    href: "/playbooks",
  },
];

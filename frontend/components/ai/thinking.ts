export type ThinkingStage = {
  icon: "sparkle" | "chart" | "search" | "brain";
  label: string;
};

const GREETING_RE =
  /^\s*(hi|hello|hey|thanks|thank you|yo|good (morning|afternoon|evening))\b/i;
const DATA_RE =
  /pnl|p&l|win rate|profit|setup|session|drawdown|symbol|expectancy|tag|perform|compare|losing|trades|risk|rr\b|r-multiple/;
const JOURNAL_RE = /journal|mistake|note|fomo|emotion|playbook|hesitat|revenge|mindset|habit/;
const NEWS_RE = /\b(news|headline|headlines|fomc|cpi|nfp|earnings)\b|what happened|market update/;

export function isSmallTalk(question: string): boolean {
  const text = question.trim();
  if (!text || text.length >= 40) return false;
  if (!GREETING_RE.test(text)) return false;
  return !DATA_RE.test(text.toLowerCase()) && !JOURNAL_RE.test(text.toLowerCase());
}

export function thinkingStages(question: string): ThinkingStage[] {
  if (isSmallTalk(question)) {
    return [{ icon: "sparkle", label: "Replying..." }];
  }

  const text = question.toLowerCase();
  const data = DATA_RE.test(text);
  const journal = JOURNAL_RE.test(text);
  const news = NEWS_RE.test(text);
  const stages: ThinkingStage[] = [{ icon: "sparkle", label: "Understanding your question..." }];
  if (news) stages.push({ icon: "search", label: "Checking recent headlines..." });
  if (data) stages.push({ icon: "chart", label: "Analyzing your trades..." });
  if (journal) stages.push({ icon: "search", label: "Looking through your journal..." });
  if (data && journal) stages.push({ icon: "brain", label: "Connecting the patterns..." });
  stages.push({ icon: "sparkle", label: "Preparing your insight..." });
  return stages;
}

export function pendingStatusLabel(question: string): string {
  if (isSmallTalk(question)) return "Replying";
  const text = question.toLowerCase();
  if (NEWS_RE.test(text)) return "Checking headlines";
  if (DATA_RE.test(text) || JOURNAL_RE.test(text)) return "Analyzing your trading data";
  return "Thinking";
}

export function followUpQuestions(question: string): string[] {
  if (isSmallTalk(question)) {
    return [
      "How am I performing this month?",
      "What is my most profitable setup?",
      "What mistakes do I repeatedly make?",
    ];
  }
  const text = question.toLowerCase();
  if (JOURNAL_RE.test(text)) {
    return [
      "What mistakes do I repeatedly make?",
      "Which trading session works best for me?",
      "How am I performing this month?",
    ];
  }
  if (DATA_RE.test(text)) {
    return [
      "Which trading session works best for me?",
      "Review my recent losing trades.",
      "What is my most profitable setup?",
    ];
  }
  return [
    "How am I performing this month?",
    "What patterns do you see in my trading?",
    "What does my journal reveal about my trading?",
  ];
}

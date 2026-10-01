import type { InsightWindow } from "@/lib/hooks/useAiInsights";
import type { AiInsightCard, AiInsightCategory, AiInsightConfidence } from "@/lib/types";

export const PERIODS: { id: InsightWindow; label: string; caption: string }[] = [
  { id: "7d", label: "7D", caption: "Insights based on last 7 days" },
  { id: "30d", label: "30D", caption: "Insights based on last 30 days" },
  { id: "90d", label: "90D", caption: "Insights based on last 90 days" },
  { id: "6m", label: "6M", caption: "Insights based on last 6 months" },
  { id: "1y", label: "1Y", caption: "Insights based on last year" },
  { id: "all", label: "All", caption: "Insights based on all logged trades" },
];

export function periodCaption(window: InsightWindow): string {
  return PERIODS.find((item) => item.id === window)?.caption ?? PERIODS[1].caption;
}

export function confidenceLine(confidence: AiInsightConfidence, sampleSize: number): string {
  if (confidence === "high") return `Strong pattern · Based on ${sampleSize} trades`;
  if (confidence === "early") return `Early signal · Only ${sampleSize} trades`;
  return `Based on ${sampleSize} trades`;
}

export function askLabel(category: AiInsightCategory): string {
  if (category === "leak" || category === "overtrading") return "Analyze This";
  if (category === "change") return "Why Is This Happening?";
  if (category === "edge" || category === "rule" || category === "behavior" || category === "early") {
    return "Explain Pattern";
  }
  return "Ask TradeFix AI";
}

export function summaryQuestion(ask: string | null | undefined): string {
  if (!ask || ask === "Ask about my performance") return "Analyse my recent performance";
  return ask;
}

const ISSUE_CATEGORIES = new Set<AiInsightCategory>(["leak", "overtrading", "behavior", "rule", "early"]);

export function briefFindings(cards: AiInsightCard[]) {
  return {
    issue: cards.find((card) => ISSUE_CATEGORIES.has(card.category)) ?? null,
    edge: cards.find((card) => card.category === "edge") ?? null,
    change: cards.find((card) => card.category === "change") ?? null,
  };
}

export function mobileCardOrder(category: AiInsightCategory): string {
  if (category === "leak" || category === "overtrading") return "order-1 lg:order-none";
  if (category === "rule" || category === "behavior") return "order-2 lg:order-none";
  if (category === "edge") return "order-3 lg:order-none";
  return "order-4 lg:order-none";
}

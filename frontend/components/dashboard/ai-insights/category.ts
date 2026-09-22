import {
  Activity,
  AlertTriangle,
  Newspaper,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AiInsightCategory } from "@/lib/types";

export const CATEGORY_META: Record<
  AiInsightCategory,
  { label: string; icon: LucideIcon; className: string }
> = {
  leak: { label: "Performance Leak", icon: TrendingDown, className: "text-[#C4473A]" },
  overtrading: { label: "Overtrading Detected", icon: AlertTriangle, className: "text-[#C4473A]" },
  behavior: { label: "Trading Pattern Detected", icon: Activity, className: "text-[#C47A1A]" },
  rule: { label: "Rule Breach Pattern", icon: ShieldAlert, className: "text-[#C47A1A]" },
  edge: { label: "Your Strongest Edge", icon: TrendingUp, className: "text-[#2F9E6A]" },
  change: { label: "Performance Changed", icon: Sparkles, className: "text-primary" },
  news: { label: "News Context", icon: Newspaper, className: "text-primary" },
  early: { label: "Early Pattern", icon: Zap, className: "text-[#C47A1A]" },
};

export function categoryMeta(category: AiInsightCategory, confidence: string) {
  if (confidence === "early") return CATEGORY_META.early;
  return CATEGORY_META[category] ?? CATEGORY_META.early;
}

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Brain,
  Clock,
  LineChart,
  Search,
  Target,
} from "lucide-react";

import type { CoachWeekly } from "@/lib/types";

export type PromptCard = {
  id: string;
  title: string;
  question: string;
  icon: LucideIcon;
};

export const BASE_PROMPTS: PromptCard[] = [
  {
    id: "performance",
    title: "Performance",
    question: "How am I performing this month?",
    icon: BarChart3,
  },
  {
    id: "setups",
    title: "Setups",
    question: "What is my most profitable setup?",
    icon: Target,
  },
  {
    id: "habits",
    title: "Trading habits",
    question: "What mistakes do I repeatedly make?",
    icon: Brain,
  },
  {
    id: "sessions",
    title: "Sessions",
    question: "Which trading session works best for me?",
    icon: Clock,
  },
  {
    id: "trades",
    title: "Trades",
    question: "Review my recent losing trades.",
    icon: LineChart,
  },
  {
    id: "patterns",
    title: "Patterns",
    question: "What patterns do you see in my trading?",
    icon: Search,
  },
  {
    id: "journal",
    title: "Journal",
    question: "What does my journal reveal about my trading?",
    icon: BookOpen,
  },
];

export const ANALYZE_CATEGORIES = [
  "Performance",
  "Setups",
  "Sessions",
  "Journal",
  "Risk",
  "Trading habits",
] as const;

export function personalizedPrompts(weekly?: CoachWeekly | null): PromptCard[] {
  const extra: PromptCard[] = [];
  const setup = weekly?.edge_finder?.best_setup?.tag?.trim();
  if (setup) {
    extra.push({
      id: `setup-${setup}`,
      title: "Your edge",
      question: `Analyze my ${setup} performance`,
      icon: Target,
    });
  }
  const day = weekly?.edge_finder?.best_day?.bucket?.trim();
  if (day) {
    extra.push({
      id: `day-${day}`,
      title: "Best day",
      question: `Why is ${day} my best trading day?`,
      icon: BarChart3,
    });
  }
  return extra.slice(0, 2);
}

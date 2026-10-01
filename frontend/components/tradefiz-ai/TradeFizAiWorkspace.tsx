"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TradeFizAIComposer } from "@/components/ai/TradeFizAIComposer";
import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { mobileCardOrder, summaryQuestion } from "@/lib/ai-insights/presentation";
import type { InsightFilterParams, InsightWindow } from "@/lib/hooks/useAiInsights";
import { useAiInsights } from "@/lib/hooks/useAiInsights";
import type { AiInsightFacets } from "@/lib/types";

import { useTradeFizAgent } from "./agent/TradeFizAgentProvider";
import { AnalyzingState } from "./AnalyzingState";
import { TradeFizAskProvider } from "./AskTradeFiz";
import { EmptyIntelligence } from "./EmptyIntelligence";
import { FocusSection } from "./FocusSection";
import { PremiumInsightCard } from "./PremiumInsightCard";
import { TradeFizHeader } from "./TradeFizHeader";
import { TradingBrief } from "./TradingBrief";

export function TradeFizAiWorkspace() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeAccount, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const [window, setWindow] = useState<InsightWindow>("30d");
  const [filters, setFilters] = useState<InsightFilterParams>({});
  const { data, isLoading, isError, refetch, isFetching } = useAiInsights(accountId, {
    enabled: !!accountId,
    window,
    filters,
  });
  const facetsRef = useRef<AiInsightFacets | null>(null);
  if (data?.facets) facetsRef.current = data.facets;

  const { askFresh, beginFresh } = useTradeFizAgent();
  const askedQuery = useRef<string | null>(null);
  const [draft, setDraft] = useState("");

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) {
        beginFresh("");
        router.push("/tradefiz-ai/chat");
        return;
      }
      const id = askFresh(text);
      router.push(`/tradefiz-ai/chat/${id}`);
    },
    [askFresh, beginFresh, router]
  );

  useEffect(() => {
    const question = searchParams.get("q")?.trim();
    if (!question || askedQuery.current === question) return;
    askedQuery.current = question;
    router.replace(`/tradefiz-ai/chat?q=${encodeURIComponent(question)}`);
  }, [searchParams, router]);

  const askQuestion = summaryQuestion(data?.summary?.ask_question);
  const showAnalyzing = accountsLoading || (!!accountId && (isLoading || (isFetching && !data)));

  const headerActions = useMemo(
    () => (
      <PortfolioSwitcher className="[&_button]:h-8 [&_button]:min-w-0 [&_button]:max-w-[168px] [&_button]:rounded-md [&_button]:border-[var(--color-border)] [&_button]:bg-[var(--color-surface)] [&_button]:px-2.5 [&_button]:text-[11px] [&_button]:shadow-none" />
    ),
    []
  );

  function explore() {
    document.getElementById("tradefix-insights")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }

  const reveal = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : 0.28, ease: "easeOut" as const },
    },
  };

  return (
    <TradeFizAskProvider ask={ask}>
      <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
        <HeaderActions subtitle="Your Personal Trading Intelligence">{headerActions}</HeaderActions>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:gap-8">
            <motion.div variants={reveal} initial={reduce ? false : "hidden"} animate="show">
              <TradeFizHeader
                window={window}
                onWindow={setWindow}
                filters={filters}
                onFilters={setFilters}
                facets={data?.facets ?? facetsRef.current}
                askQuestion={askQuestion}
                tradeCount={data?.trades_analysed}
              >
                <TradeFizAIComposer
                  variant="full"
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => {
                    const text = draft.trim();
                    if (!text) {
                      beginFresh("");
                      router.push("/tradefiz-ai/chat");
                      return;
                    }
                    ask(text);
                  }}
                />
              </TradeFizHeader>
            </motion.div>

            {showAnalyzing ? (
              <AnalyzingState />
            ) : isError ? (
              <div className="dash-card border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-foreground">
                Couldn&apos;t load TradeFix AI.
                <button type="button" className="ml-3 text-primary" onClick={() => void refetch()}>
                  Retry
                </button>
              </div>
            ) : !data || !data.enough_data ? (
              <EmptyIntelligence tradesAnalysed={data?.trades_analysed ?? 0} />
            ) : (
              <motion.div
                className="flex flex-col gap-6 lg:gap-8"
                initial={reduce ? false : "hidden"}
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.04 } },
                }}
              >
                <motion.div variants={reveal}>
                  <TradingBrief
                    summary={data.summary}
                    cards={data.insights}
                    askQuestion={askQuestion}
                    onExplore={explore}
                  />
                </motion.div>

                <motion.div variants={reveal}>
                  {data.insights.length > 0 ? (
                    <div id="tradefix-insights" className="grid scroll-mt-4 grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:gap-5">
                      {data.insights.map((card) => (
                        <div key={card.id} className={`h-full ${mobileCardOrder(card.category)}`}>
                          <PremiumInsightCard card={card} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div id="tradefix-insights" className="dash-card px-5 py-8 text-center">
                      <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                        TradeFix hasn&apos;t found a strong enough pattern yet.
                      </p>
                      <p className="mt-1 text-[14px] text-[var(--color-text-secondary)]">
                        Keep logging trades and the next pattern will show up here.
                      </p>
                    </div>
                  )}
                </motion.div>

                {data.focus ? (
                  <motion.div variants={reveal}>
                    <FocusSection focus={data.focus} />
                  </motion.div>
                ) : null}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </TradeFizAskProvider>
  );
}

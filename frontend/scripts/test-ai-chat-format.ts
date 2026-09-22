import assert from "node:assert/strict";

import { answerPlainText, extractStats, shapeAnswer, sourceHref, sourceLabel, statKind, valueTone } from "../components/ai/format";
import { followUpQuestions, isSmallTalk, pendingStatusLabel, thinkingStages } from "../components/ai/thinking";

const chips = extractStats(
  "Based on your recent 47 trades, win rate is 44.7% and expectancy of -$125 with 2.1R avg winner."
);
assert.equal(chips.find((c) => c.label === "Trades")?.value, "47");
assert.equal(chips.find((c) => c.label === "Win rate")?.value, "44.7%");
assert.equal(chips.find((c) => c.label === "Expectancy")?.value, "-$125");
assert.equal(chips.find((c) => c.label === "Avg winner")?.value, "2.1R");

assert.equal(sourceHref({ type: "playbook", id: "abc", title: "Breakout" }), "/playbooks/abc");
assert.equal(
  sourceHref({ type: "web", id: "n1", title: "Fed", url: "https://news.google.com/rss/articles/abc" }),
  "https://news.google.com/rss/articles/abc"
);
assert.equal(sourceHref({ type: "web", id: "n1", title: "Fed", url: "http://example.com" }), null);
assert.equal(sourceHref({ type: "trade_note", id: "t1", title: "EURUSD" }), "/trades/t1");
assert.equal(
  sourceHref({ type: "day_note", id: "n1", title: "Day journal", date: "2026-09-15" }),
  "/notebook?folder=daily&date=2026-09-15"
);
assert.equal(sourceHref({ type: "trade_comment", id: "c1", title: "Comment" }), null);

assert.match(sourceLabel({ type: "day_note", id: "n1", title: "Day journal", date: "2026-09-15" }), /Day journal/);
assert.equal(sourceLabel({ type: "playbook", id: "p1", title: "Breakout Playbook" }), "Breakout Playbook");

assert.equal(isSmallTalk("hello"), true);
assert.equal(isSmallTalk("What is my win rate?"), false);
assert.equal(thinkingStages("hello")[0].label, "Replying...");
assert.equal(pendingStatusLabel("hello"), "Replying");
assert.ok(thinkingStages("How am I performing this month?").some((s) => s.label.includes("trades")));
assert.ok(!thinkingStages("hello").some((s) => /analyzing your trading data/i.test(s.label)));
const sample = [
  "### Summary",
  "Total P&L for 2026-09-01 to 2026-09-21: +$1,230.50",
  "Loss count: 3 trades",
  "Average loss per losing trade: –$219.67",
  "",
  "### What the data shows",
  "The three losing trades together account for a total loss of $659.01.",
  "The remaining four winning trades produced a net gain of $1,889.51.",
  "",
  "### Suggested reflection",
  "- Review the three losing trades to identify common factors.",
  "- Consider tightening risk management.",
  "",
  "**Total P&L for 2026-09-01 to 2026-09-21:** +$1,230.50",
  "**Loss count:** 3 trades",
  "The three losing trades together account for a total loss of **$659.01**.",
].join("\n");

const shaped = shapeAnswer(sample);
assert.equal(shaped.kind, "briefing");
assert.equal(shaped.stats.length, 3);
assert.equal(shaped.stats[0].value, "+$1,230.50");
assert.equal(shaped.paragraphs.length, 2);
assert.equal(shaped.reflection.length, 2);
assert.equal(shaped.paragraphs.filter((line) => /summary|suggested reflection/i.test(line)).length, 0);
assert.ok(!answerPlainText(sample).includes("###"));
assert.ok(!answerPlainText(sample).includes("**"));
assert.equal(valueTone("+$1,230.50"), "up");
assert.equal(valueTone("–$219.67"), "down");
assert.equal(statKind("Total P&L for 2026-09-01 to 2026-09-21"), "pnl");
assert.equal(statKind("Average loss per losing trade"), "loss");
assert.equal(statKind("Loss count"), "loss");
assert.equal(shapeAnswer("Hello. I can help you review your trades.").kind, "prose");

assert.equal(followUpQuestions("hello").length, 3);
assert.ok(followUpQuestions("What is my win rate?").some((item) => /session/i.test(item)));

console.log("ai-chat-format ok");

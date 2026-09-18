import { outcomeStats, type OutcomeStats } from "@/lib/reports/group";
import type { UserPlaybook } from "@/lib/playbooks/types";
import type { DisplayPnlFn } from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

export type PlaybookPerformance = OutcomeStats & {
  expectancy: number | null;
  winLoss: string;
};

export function playbookMatchingName(playbooks: UserPlaybook[], name: string | null | undefined): UserPlaybook | undefined {
  const key = (name || "").trim().toLowerCase();
  if (!key) return undefined;
  return playbooks.find((p) => p.name.trim().toLowerCase() === key);
}

export function tradesForPlaybook(trades: Trade[], playbook: UserPlaybook): Trade[] {
  const name = playbook.name.trim().toLowerCase();
  return trades.filter((trade) => {
    if (trade.playbook_id && trade.playbook_id === playbook.id) return true;
    const assigned = (trade.strategy_name || trade.setup_tag || "").trim().toLowerCase();
    return Boolean(name) && assigned === name;
  });
}

export function playbookPerformance(trades: Trade[], displayPnl: DisplayPnlFn): PlaybookPerformance {
  const stats = outcomeStats(trades, displayPnl);
  const closed = stats.wins + stats.losses + stats.be;
  const expectancy =
    closed > 0 ? Number(((stats.winPnl + stats.lossPnl) / closed).toFixed(2)) : null;
  let winLoss = "N/A";
  if (stats.wins || stats.losses) winLoss = `${stats.wins}/${stats.losses}`;
  return { ...stats, expectancy, winLoss };
}

export function templatePerformance(
  trades: Trade[],
  playbook: UserPlaybook | undefined,
  displayPnl: DisplayPnlFn
): PlaybookPerformance {
  if (!playbook) {
    return playbookPerformance([], displayPnl);
  }
  return playbookPerformance(tradesForPlaybook(trades, playbook), displayPnl);
}

"use client";

import { Download, Share2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { OverviewStats } from "@/lib/types";

type FormatMoney = (n: number, opts?: { signed?: boolean; digits?: number }) => string;

export function ShareCard({
  overview,
  formatMoney,
  accountName,
}: {
  overview: OverviewStats;
  formatMoney: FormatMoney;
  accountName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function renderPng(): Promise<Blob | null> {
    const node = ref.current;
    if (!node) return null;

    const width = 720;
    const height = 420;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Dark card background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    ctx.fillStyle = "#00c896";
    ctx.font = "600 22px DM Sans, system-ui, sans-serif";
    ctx.fillText("trade", 40, 52);
    ctx.fillStyle = "#fafafa";
    ctx.fillText("fix", 98, 52);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "400 14px DM Sans, system-ui, sans-serif";
    ctx.fillText(accountName ? `${accountName} · performance card` : "Performance card", 40, 78);

    const stats: [string, string][] = [
      ["Win rate", `${overview.win_rate}%`],
      ["Total P&L", formatMoney(overview.total_pnl)],
      ["Expectancy", formatMoney(overview.expectancy)],
      ["Profit factor", overview.profit_factor ? overview.profit_factor.toFixed(2) : "—"],
      [
        "Execution score",
        overview.avg_execution_score != null ? `${Math.round(overview.avg_execution_score)}/100` : "—",
      ],
      [
        "Avg R",
        overview.avg_r_multiple != null ? `${overview.avg_r_multiple.toFixed(2)}R` : "—",
      ],
      ["Trades", String(overview.total_trades)],
      [
        "Max drawdown",
        overview.max_drawdown != null ? formatMoney(-(overview.max_drawdown ?? 0)) : "—",
      ],
    ];

    stats.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + col * 340;
      const y = 120 + row * 60;
      ctx.fillStyle = "#71717a";
      ctx.font = "500 12px DM Sans, system-ui, sans-serif";
      ctx.fillText(label.toUpperCase(), x, y);
      ctx.fillStyle = "#fafafa";
      ctx.font = "600 22px DM Sans, system-ui, sans-serif";
      ctx.fillText(value, x, y + 28);
    });

    ctx.fillStyle = "#52525b";
    ctx.font = "400 12px DM Sans, system-ui, sans-serif";
    ctx.fillText("Generated with TradeFix", 40, height - 28);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await renderPng();
      if (!blob) throw new Error("Could not render card");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tradefix-share-card.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Share card downloaded");
    } catch (e) {
      toast.error("Could not create share card", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await renderPng();
      if (!blob) throw new Error("Could not render card");
      const file = new File([blob], "tradefix-share-card.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "TradeFix performance" });
      } else {
        await download();
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Share failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Hidden DOM summary for a11y / future html-to-image */}
      <div ref={ref} className="sr-only" aria-hidden>
        TradeFix share card · WR {overview.win_rate}% · P&L {formatMoney(overview.total_pnl)}
      </div>
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={download}>
        <Download className="h-3.5 w-3.5" />
        Card
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={share}>
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>
    </div>
  );
}

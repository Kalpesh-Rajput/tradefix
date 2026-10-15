import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notices" };

export default function NoticesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Notices</h1>
      <section className="dash-card space-y-2 p-5 text-sm text-foreground">
        <h2 className="font-medium">Charts</h2>
        <p>
          Candle charts use{" "}
          <a className="text-primary hover:underline" href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noopener noreferrer">
            TradingView Lightweight Charts™
          </a>
          . TradingView does not provide the market data and is not affiliated with TradeFix.
        </p>
      </section>
      <section className="dash-card space-y-2 p-5 text-sm text-foreground">
        <h2 className="font-medium">Market data</h2>
        <p>
          Crypto candles come from Binance public endpoints. Forex and metal history, when enabled, comes from Dukascopy and is limited to personal use unless you hold a separate licence. Disable it with <span className="font-mono">DUKASCOPY_ENABLED=false</span>.
        </p>
      </section>
    </div>
  );
}

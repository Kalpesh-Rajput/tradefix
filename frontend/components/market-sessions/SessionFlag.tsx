"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

import type { MarketSessionId } from "@/lib/market-sessions/types";

export type SessionFlagCode = "AU" | "JP" | "GB" | "US";

const FLAG_BY_SESSION: Record<string, SessionFlagCode> = {
  sydney: "AU",
  tokyo: "JP",
  london: "GB",
  new_york: "US",
};

export function flagForSession(id: MarketSessionId | string): SessionFlagCode | null {
  return FLAG_BY_SESSION[id] ?? null;
}

const CURRENCY_FLAG: Record<string, string> = {
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  JPY: "JP",
  INR: "IN",
  AUD: "AU",
  CAD: "CA",
  CHF: "CH",
  SGD: "SG",
  AED: "AE",
  CNY: "CN",
  HKD: "HK",
  NZD: "NZ",
  KRW: "KR",
  BRL: "BR",
  MXN: "MX",
  ZAR: "ZA",
  SEK: "SE",
  NOK: "NO",
  DKK: "DK",
  PLN: "PL",
  TRY: "TR",
  THB: "TH",
  PHP: "PH",
  IDR: "ID",
  MYR: "MY",
  ILS: "IL",
  CZK: "CZ",
  HUF: "HU",
  RON: "RO",
  BGN: "BG",
  ISK: "IS",
};

export function flagForCurrency(code: string): string {
  const upper = code.trim().toUpperCase();
  return CURRENCY_FLAG[upper] ?? upper.slice(0, 2);
}

function FlagAu() {
  return (
    <>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0h10v7H0z" fill="#012169" />
      <path d="M0 0l10 7M10 0L0 7" stroke="#fff" strokeWidth="1.6" />
      <path d="M0 0l10 7M10 0L0 7" stroke="#C8102E" strokeWidth="0.7" />
      <path d="M5 0v7M0 3.5h10" stroke="#fff" strokeWidth="2.2" />
      <path d="M5 0v7M0 3.5h10" stroke="#C8102E" strokeWidth="1.1" />
      <path fill="#fff" d="M15.2 8.1l.35 1.08h1.14l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.14z" />
      <path fill="#fff" d="M17.6 10.4l.22.7h.74l-.6.43.22.7-.58-.43-.6.43.23-.7-.6-.43h.74z" />
      <path fill="#fff" d="M13.3 11.1l.18.56h.6l-.48.35.18.56-.48-.35-.48.35.18-.56-.48-.35h.6z" />
      <circle cx="12.2" cy="8.6" r="0.45" fill="#fff" />
      <circle cx="18.4" cy="8.2" r="0.4" fill="#fff" />
    </>
  );
}

function FlagJp() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <circle cx="10" cy="7" r="3.35" fill="#BC002D" />
    </>
  );
}

function FlagGb() {
  return (
    <>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#fff" strokeWidth="3.2" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M10 0v14M0 7h20" stroke="#fff" strokeWidth="4.4" />
      <path d="M10 0v14M0 7h20" stroke="#C8102E" strokeWidth="2.4" />
    </>
  );
}

function FlagUs() {
  return (
    <>
      <rect width="20" height="14" fill="#BF0A30" />
      <path
        d="M0 1.17h20M0 3.5h20M0 5.83h20M0 8.17h20M0 10.5h20M0 12.83h20"
        stroke="#fff"
        strokeWidth="1.16"
      />
      <rect width="9.2" height="7.4" fill="#002868" />
      {[0, 1, 2, 3].map((row) =>
        Array.from({ length: row % 2 === 0 ? 5 : 4 }, (_, i) => (
          <circle
            key={`${row}-${i}`}
            cx={row % 2 === 0 ? 1.15 + i * 1.75 : 2 + i * 1.75}
            cy={1.05 + row * 1.55}
            r="0.38"
            fill="#fff"
          />
        ))
      )}
    </>
  );
}

function FlagEu() {
  return (
    <>
      <rect width="20" height="14" fill="#003399" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i * 30 - 90) * Math.PI) / 180;
        return <circle key={i} cx={10 + Math.cos(a) * 4.1} cy={7 + Math.sin(a) * 4.1} r="0.55" fill="#FFCC00" />;
      })}
    </>
  );
}

function FlagIn() {
  return (
    <>
      <rect width="20" height="14" fill="#FF9933" />
      <rect y="4.66" width="20" height="4.68" fill="#fff" />
      <rect y="9.34" width="20" height="4.66" fill="#138808" />
      <circle cx="10" cy="7" r="1.55" fill="none" stroke="#000088" strokeWidth="0.35" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        return (
          <line
            key={i}
            x1={10 - Math.cos(a) * 1.4}
            y1={7 - Math.sin(a) * 1.4}
            x2={10 + Math.cos(a) * 1.4}
            y2={7 + Math.sin(a) * 1.4}
            stroke="#000088"
            strokeWidth="0.2"
          />
        );
      })}
    </>
  );
}

function FlagCa() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="5" height="14" fill="#FF0000" />
      <rect x="15" width="5" height="14" fill="#FF0000" />
      <path fill="#FF0000" d="M10 3.1l.7 2.1h2.2l-1.8 1.3.7 2.1L10 7.3l-1.8 1.3.7-2.1-1.8-1.3h2.2z" />
    </>
  );
}

function FlagCh() {
  return (
    <>
      <rect width="20" height="14" fill="#FF0000" />
      <rect x="8.2" y="3.2" width="3.6" height="7.6" fill="#fff" />
      <rect x="6.2" y="5.2" width="7.6" height="3.6" fill="#fff" />
    </>
  );
}

function FlagSg() {
  return (
    <>
      <rect width="20" height="14" fill="#ED2939" />
      <rect y="7" width="20" height="7" fill="#fff" />
      <circle cx="5.2" cy="3.6" r="2.05" fill="#fff" />
      <circle cx="6.1" cy="3.6" r="1.65" fill="#ED2939" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = ((i * 72 - 90) * Math.PI) / 180;
        return <circle key={i} cx={8.6 + Math.cos(a) * 1.35} cy={3.6 + Math.sin(a) * 1.35} r="0.28" fill="#fff" />;
      })}
    </>
  );
}

function FlagAe() {
  return (
    <>
      <rect width="20" height="14" fill="#00732F" />
      <rect y="4.66" width="20" height="4.68" fill="#fff" />
      <rect y="9.34" width="20" height="4.66" fill="#000" />
      <rect width="5" height="14" fill="#FF0000" />
    </>
  );
}

function FlagCn() {
  return (
    <>
      <rect width="20" height="14" fill="#DE2910" />
      <path fill="#FFDE00" d="M4.2 2.4l.45 1.35h1.42L6.4 4.6l.45 1.35L5.4 5.1l-1.45.85.45-1.35-1.17-.72h1.42z" />
    </>
  );
}

function FlagHk() {
  return (
    <>
      <rect width="20" height="14" fill="#DE2910" />
      <circle cx="10" cy="7" r="2.1" fill="#fff" />
      <circle cx="10" cy="7" r="0.7" fill="#DE2910" />
    </>
  );
}

function FlagNz() {
  return (
    <>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0h10v7H0z" fill="#012169" />
      <path d="M0 0l10 7M10 0L0 7" stroke="#fff" strokeWidth="1.6" />
      <path d="M0 0l10 7M10 0L0 7" stroke="#C8102E" strokeWidth="0.7" />
      <path d="M5 0v7M0 3.5h10" stroke="#fff" strokeWidth="2.2" />
      <path d="M5 0v7M0 3.5h10" stroke="#C8102E" strokeWidth="1.1" />
      <path fill="#C8102E" stroke="#fff" strokeWidth="0.2" d="M14.4 7.2l.4 1.15h1.2l-.95.7.36 1.12-.98-.7-.98.7.36-1.12-.95-.7h1.2z" />
    </>
  );
}

function FlagKr() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <circle cx="10" cy="7" r="2.4" fill="#CD2E3A" />
      <path d="M7.6 7a2.4 2.4 0 0 0 4.8 0" fill="#0047A0" />
    </>
  );
}

function FlagBr() {
  return (
    <>
      <rect width="20" height="14" fill="#009C3B" />
      <path d="M10 1.6L18.4 7 10 12.4 1.6 7z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="2.1" fill="#002776" />
    </>
  );
}

function FlagMx() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="6.6" height="14" fill="#006847" />
      <rect x="13.4" width="6.6" height="14" fill="#CE1126" />
      <circle cx="10" cy="7" r="1.4" fill="#C4A000" />
    </>
  );
}

function FlagZa() {
  return (
    <>
      <rect width="20" height="14" fill="#DE3831" />
      <rect y="9.2" width="20" height="4.8" fill="#002395" />
      <path d="M0 0l9 7-9 7z" fill="#007A4D" />
      <path d="M0 2.4L6.6 7 0 11.6z" fill="#FFB612" />
      <path d="M0 4.1L4.6 7 0 9.9z" fill="#000" />
    </>
  );
}

function FlagSe() {
  return (
    <>
      <rect width="20" height="14" fill="#006AA7" />
      <rect x="6" width="3" height="14" fill="#FECC00" />
      <rect y="5.5" width="20" height="3" fill="#FECC00" />
    </>
  );
}

function FlagNo() {
  return (
    <>
      <rect width="20" height="14" fill="#BA0C2F" />
      <rect x="5.4" width="3.4" height="14" fill="#fff" />
      <rect y="5.3" width="20" height="3.4" fill="#fff" />
      <rect x="6.2" width="1.8" height="14" fill="#00205B" />
      <rect y="6.1" width="20" height="1.8" fill="#00205B" />
    </>
  );
}

function FlagDk() {
  return (
    <>
      <rect width="20" height="14" fill="#C8102E" />
      <rect x="6.2" width="2.2" height="14" fill="#fff" />
      <rect y="5.9" width="20" height="2.2" fill="#fff" />
    </>
  );
}

function FlagPl() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect y="7" width="20" height="7" fill="#DC143C" />
    </>
  );
}

function FlagTr() {
  return (
    <>
      <rect width="20" height="14" fill="#E30A17" />
      <circle cx="8.1" cy="7" r="3.1" fill="#fff" />
      <circle cx="9.2" cy="7" r="2.45" fill="#E30A17" />
      <path fill="#fff" d="M12.6 7l-1.55.5.95-1.35v1.7l.95-1.35z" />
    </>
  );
}

function FlagTh() {
  return (
    <>
      <rect width="20" height="14" fill="#A51931" />
      <rect y="2.3" width="20" height="2.3" fill="#fff" />
      <rect y="4.6" width="20" height="4.8" fill="#2D2A4A" />
      <rect y="9.4" width="20" height="2.3" fill="#fff" />
    </>
  );
}

function FlagPh() {
  return (
    <>
      <rect width="20" height="7" fill="#0038A8" />
      <rect y="7" width="20" height="7" fill="#CE1126" />
      <path d="M0 0l8.4 7L0 14z" fill="#fff" />
      <circle cx="3.1" cy="7" r="1.1" fill="#FCD116" />
    </>
  );
}

function FlagId() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="20" height="7" fill="#CE1126" />
    </>
  );
}

function FlagMy() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <path d="M0 1.27h20M0 3.82h20M0 6.36h20M0 8.91h20M0 11.45h20" stroke="#CC0001" strokeWidth="1.27" />
      <rect width="9.5" height="7.4" fill="#010066" />
      <circle cx="5.6" cy="3.7" r="1.8" fill="#FFCC00" />
    </>
  );
}

function FlagIl() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect y="1.6" width="20" height="1.8" fill="#0038B8" />
      <rect y="10.6" width="20" height="1.8" fill="#0038B8" />
      <path d="M10 4.4l2.3 4H7.7zM10 9.6l2.3-4H7.7z" fill="none" stroke="#0038B8" strokeWidth="0.55" />
    </>
  );
}

function FlagCz() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect y="7" width="20" height="7" fill="#D7141A" />
      <path d="M0 0l8.5 7L0 14z" fill="#11457E" />
    </>
  );
}

function FlagHu() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="20" height="4.66" fill="#CE2939" />
      <rect y="9.34" width="20" height="4.66" fill="#477050" />
    </>
  );
}

function FlagRo() {
  return (
    <>
      <rect width="20" height="14" fill="#FCD116" />
      <rect width="6.66" height="14" fill="#002B7F" />
      <rect x="13.34" width="6.66" height="14" fill="#CE1126" />
    </>
  );
}

function FlagBg() {
  return (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect y="4.66" width="20" height="4.68" fill="#00966E" />
      <rect y="9.34" width="20" height="4.66" fill="#D62612" />
    </>
  );
}

function FlagIs() {
  return (
    <>
      <rect width="20" height="14" fill="#02529C" />
      <rect x="5.4" width="3.4" height="14" fill="#fff" />
      <rect y="5.3" width="20" height="3.4" fill="#fff" />
      <rect x="6.2" width="1.8" height="14" fill="#DC1E35" />
      <rect y="6.1" width="20" height="1.8" fill="#DC1E35" />
    </>
  );
}

function FlagFallback({ letters }: { letters: string }) {
  return (
    <>
      <rect width="20" height="14" fill="#4B5563" />
      <text
        x="10"
        y="9.4"
        textAnchor="middle"
        fill="#fff"
        fontSize="6.2"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
      >
        {letters.slice(0, 2).toUpperCase()}
      </text>
    </>
  );
}

const FLAG_ART: Record<string, () => ReactNode> = {
  AU: FlagAu,
  JP: FlagJp,
  GB: FlagGb,
  US: FlagUs,
  EU: FlagEu,
  IN: FlagIn,
  CA: FlagCa,
  CH: FlagCh,
  SG: FlagSg,
  AE: FlagAe,
  CN: FlagCn,
  HK: FlagHk,
  NZ: FlagNz,
  KR: FlagKr,
  BR: FlagBr,
  MX: FlagMx,
  ZA: FlagZa,
  SE: FlagSe,
  NO: FlagNo,
  DK: FlagDk,
  PL: FlagPl,
  TR: FlagTr,
  TH: FlagTh,
  PH: FlagPh,
  ID: FlagId,
  MY: FlagMy,
  IL: FlagIl,
  CZ: FlagCz,
  HU: FlagHu,
  RO: FlagRo,
  BG: FlagBg,
  IS: FlagIs,
};

export function SessionFlag({
  sessionId,
  code,
  currency,
  size = "md",
  className,
  title,
}: {
  sessionId?: MarketSessionId | string;
  code?: string;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  const resolved =
    code?.toUpperCase() ||
    (sessionId ? flagForSession(sessionId) : null) ||
    (currency ? flagForCurrency(currency) : null);
  if (!resolved) return null;
  const Art = FLAG_ART[resolved] ?? (() => <FlagFallback letters={resolved} />);
  const dim = size === "lg" ? "h-[16px] w-[22px]" : size === "sm" ? "h-[10px] w-[14px]" : "h-[13px] w-[18px]";

  return (
    <svg
      viewBox="0 0 20 14"
      className={clsx(
        "inline-block shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(20,20,30,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.16)]",
        dim,
        className
      )}
      aria-hidden={!title}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <Art />
    </svg>
  );
}

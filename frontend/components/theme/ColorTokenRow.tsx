"use client";

import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";

import { colorChannels, hslToColor, opaqueHex, parseCssColor, rgbToColor } from "@/lib/custom-theme";
import type { ThemeTokenDef } from "@/lib/custom-theme-tokens";

export function ColorTokenRow({
  token,
  value,
  changed,
  onChange,
  onReset,
}: {
  token: ThemeTokenDef;
  value: string;
  changed: boolean;
  onChange: (next: string) => void;
  onReset: () => void;
}) {
  const hexId = useId();
  const errorId = useId();
  const [hexDraft, setHexDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [advanced, setAdvanced] = useState(false);
  if (value !== seen) {
    setSeen(value);
    setHexDraft(value);
  }

  const parsed = parseCssColor(hexDraft);
  const invalid = hexDraft.trim().length > 0 && !parsed;
  const channels = colorChannels(value);
  const pickerValue = opaqueHex(value) ?? "#000000";

  function commit(next: string) {
    const color = parseCssColor(next);
    if (!color) return;
    const formatted = formatFromParsed(next);
    if (!formatted || formatted === value) return;
    onChange(formatted);
  }

  return (
    <div className={clsx("rounded-lg border px-3 py-2.5", changed ? "border-primary/50 bg-primary/5" : "border-border bg-surface")}>
      <div className="flex items-start gap-3">
        <label className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border" style={{ background: checkerboard() }}>
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={pickerValue}
            aria-label={`${token.label} color picker`}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => {
              const alpha = parseCssColor(value)?.a ?? 1;
              const next = alpha >= 0.999 ? event.target.value.toUpperCase() : withAlpha(event.target.value, alpha);
              if (next) onChange(next);
            }}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <label htmlFor={hexId} className="block text-[13px] font-semibold text-foreground">
                {token.label}
              </label>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{token.description}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
              aria-label={`Reset ${token.label}`}
              disabled={!changed}
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id={hexId}
              value={hexDraft}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              spellCheck={false}
              autoCapitalize="characters"
              className={clsx(
                "h-8 w-[9.5rem] rounded-md border bg-surface px-2 font-mono text-xs uppercase text-foreground outline-none",
                invalid ? "border-destructive" : "border-border focus:border-primary"
              )}
              onChange={(event) => {
                const next = event.target.value;
                setHexDraft(next);
                const color = parseCssColor(next);
                if (color) commit(next);
              }}
              onBlur={() => {
                if (!parseCssColor(hexDraft)) setHexDraft(value);
              }}
            />
            <button
              type="button"
              className="h-8 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/5"
              aria-expanded={advanced}
              onClick={() => setAdvanced((open) => !open)}
            >
              {advanced ? "Hide RGB and HSL" : "RGB and HSL"}
            </button>
          </div>
          {invalid && (
            <p id={errorId} className="mt-1 text-[11px] text-destructive">
              Use #RGB, #RRGGBB, or #RRGGBBAA.
            </p>
          )}
          {token.alpha && channels && (
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              Opacity
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(channels.rgb.a * 100)}
                aria-label={`${token.label} opacity`}
                className="min-w-0 flex-1"
                onChange={(event) => {
                  const next = withAlpha(pickerValue, Number(event.target.value) / 100);
                  if (next) onChange(next);
                }}
              />
              <span className="w-8 tabular-nums">{Math.round(channels.rgb.a * 100)}%</span>
            </label>
          )}
          {advanced && channels && (
            <AdvancedFields tokenLabel={token.label} value={value} onChange={onChange} />
          )}
        </div>
      </div>
    </div>
  );
}

function AdvancedFields({
  tokenLabel,
  value,
  onChange,
}: {
  tokenLabel: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const channels = colorChannels(value);
  const [rgb, setRgb] = useState(channels ? `${channels.rgb.r}, ${channels.rgb.g}, ${channels.rgb.b}` : "");
  const [hsl, setHsl] = useState(channels ? `${channels.hsl.h}, ${channels.hsl.s}, ${channels.hsl.l}` : "");
  const [seen, setSeen] = useState(value);
  if (value !== seen && channels) {
    setSeen(value);
    setRgb(`${channels.rgb.r}, ${channels.rgb.g}, ${channels.rgb.b}`);
    setHsl(`${channels.hsl.h}, ${channels.hsl.s}, ${channels.hsl.l}`);
  }
  const alpha = channels?.rgb.a ?? 1;

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <ChannelField
        label="RGB"
        value={rgb}
        hint="0–255"
        tokenLabel={tokenLabel}
        invalid={rgb.trim().length > 0 && !parseRgb(rgb)}
        onChange={(next) => {
          setRgb(next);
          const parsed = parseRgb(next);
          if (!parsed) return;
          const color = rgbToColor(parsed[0], parsed[1], parsed[2], alpha);
          if (color) onChange(color);
        }}
      />
      <ChannelField
        label="HSL"
        value={hsl}
        hint="H 0–360, S and L 0–100"
        tokenLabel={tokenLabel}
        invalid={hsl.trim().length > 0 && !parseHsl(hsl)}
        onChange={(next) => {
          setHsl(next);
          const parsed = parseHsl(next);
          if (!parsed) return;
          const color = hslToColor(parsed[0], parsed[1], parsed[2], alpha);
          if (color) onChange(color);
        }}
      />
    </div>
  );
}

function ChannelField({
  label,
  value,
  hint,
  tokenLabel,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  hint: string;
  tokenLabel: string;
  invalid: boolean;
  onChange: (next: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        aria-label={`${tokenLabel} ${label}`}
        aria-invalid={invalid}
        className={clsx(
          "mt-1 h-8 w-full rounded-md border bg-surface px-2 font-mono text-xs text-foreground outline-none",
          invalid ? "border-destructive" : "border-border focus:border-primary"
        )}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className={clsx("mt-1 text-[10px]", invalid ? "text-destructive" : "text-muted")}>
        {invalid ? `Enter ${hint}.` : hint}
      </p>
    </div>
  );
}

function parseRgb(value: string): [number, number, number] | null {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 3) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return [numbers[0], numbers[1], numbers[2]];
}

function parseHsl(value: string): [number, number, number] | null {
  const parts = value.split(",").map((part) => part.trim().replace("%", ""));
  if (parts.length !== 3) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isFinite(part))) return null;
  const [h, s, l] = numbers;
  if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) return null;
  return [h, s, l];
}

function withAlpha(hex: string, alpha: number): string | null {
  const opaque = opaqueHex(hex);
  if (!opaque) return null;
  const parsed = parseCssColor(opaque);
  if (!parsed) return null;
  return formatFromParsed(opaque, alpha);
}

function formatFromParsed(input: string, alpha?: number): string | null {
  const parsed = parseCssColor(input);
  if (!parsed) return null;
  const next = { ...parsed, a: alpha ?? parsed.a };
  const hex = [next.r, next.g, next.b].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
  if (next.a >= 0.999) return `#${hex}`;
  const aa = Math.round(next.a * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${hex}${aa}`;
}

function checkerboard(): string {
  return "linear-gradient(45deg, #d8d8de 25%, transparent 25%), linear-gradient(-45deg, #d8d8de 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d8d8de 75%), linear-gradient(-45deg, transparent 75%, #d8d8de 75%)";
}

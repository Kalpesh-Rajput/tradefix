"use client";

import { Copy, Eye, EyeOff, Lock, Trash2, Unlock, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { barStep } from "../timeMapper";
import type { DrawingStore } from "../store";
import { SWATCHES, isFib, isPosition, toolDef } from "../tools";
import type { BarLike, DrawingContext, DrawingStyle } from "../types";
import { FIELD, IconToggle } from "./fields";
import { FibLevelsEditor } from "./FibLevelsEditor";
import { PositionEditor, type SimulateHandler } from "./PositionEditor";
import { useStoreVersion } from "./useStore";

const AREA_TOOLS = new Set(["rectangle", "ellipse", "triangle", "parallel_channel"]);

function TextEditor({ id, value, store }: { id: string; value: string; store: DrawingStore }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (value === "Text") ref.current?.select();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="block text-[11px] text-muted">
      Text
      <textarea
        ref={ref}
        key={`${id}-${value}`}
        defaultValue={value}
        rows={3}
        maxLength={240}
        onBlur={(event) => {
          const text = event.target.value.trim() || "Text";
          if (text !== value) store.patch(id, { props: { ...(store.selectedDrawing?.props ?? {}), text } });
        }}
        className={`${FIELD} mt-0.5 h-auto resize-none py-1.5`}
      />
    </label>
  );
}

export function DrawingProperties({
  store,
  ctx,
  bars,
  unit,
  onSimulate,
}: {
  store: DrawingStore;
  ctx: DrawingContext;
  bars: () => readonly BarLike[];
  unit: string;
  onSimulate?: SimulateHandler;
}) {
  useStoreVersion(store);
  const drawing = store.selectedDrawing;
  if (!drawing) return null;
  const style = drawing.style;
  const setStyle = (change: Partial<DrawingStyle>) => store.patch(drawing.id, { style: { ...style, ...change } });
  const detailed = isFib(drawing.tool) || isPosition(drawing.tool) || drawing.tool === "text";
  const hasArea = AREA_TOOLS.has(drawing.tool);

  return (
    <section
      aria-label={`${toolDef(drawing.tool).label} settings`}
      className="absolute right-[4.5rem] top-2 z-20 w-64 max-h-[calc(100%-1rem)] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg"
    >
      <h2 className="truncate px-1 pb-1 text-xs font-semibold text-foreground">{toolDef(drawing.tool).label}</h2>
      <header className="flex items-center gap-0.5 border-b border-border pb-1.5">
        <IconToggle label={drawing.locked ? "Unlock" : "Lock"} pressed={drawing.locked} onClick={() => store.patch(drawing.id, { locked: !drawing.locked })}>
          {drawing.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </IconToggle>
        <IconToggle label={drawing.visible ? "Hide" : "Show"} onClick={() => store.patch(drawing.id, { visible: !drawing.visible })}>
          {drawing.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconToggle>
        <IconToggle label="Duplicate" onClick={() => store.duplicate(drawing.id, { t: barStep(bars()) * 3, p: -(Math.abs(drawing.anchors[0]?.p ?? 0) * 0.0005) })}>
          <Copy className="h-4 w-4" />
        </IconToggle>
        <IconToggle label="Delete" danger onClick={() => (drawing.locked ? undefined : store.remove(drawing.id))}>
          <Trash2 className="h-4 w-4" />
        </IconToggle>
        <span className="mx-auto" />
        <IconToggle label="Close settings" onClick={() => store.select(null)}>
          <X className="h-4 w-4" />
        </IconToggle>
      </header>
      {drawing.locked ? <p className="mt-1 px-1 text-[11px] text-muted">Locked. Unlock to edit or delete.</p> : null}
      <fieldset disabled={drawing.locked} className="mt-2 min-w-0 space-y-2 border-0 p-0 disabled:opacity-60">
        {!isPosition(drawing.tool) ? (
          <>
            <div role="group" aria-label="Colour" className="flex flex-wrap justify-between gap-y-1">
              {SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Colour ${color}`}
                  aria-pressed={style.color.toLowerCase() === color}
                  onClick={() => setStyle({ color })}
                  className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${style.color.toLowerCase() === color ? "border-foreground ring-1 ring-foreground" : "border-border"}`}
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted">
                Width
                <select value={style.width} onChange={(event) => setStyle({ width: Number(event.target.value) })} className={`${FIELD} mt-0.5`}>
                  {[1, 2, 3, 4].map((width) => (
                    <option key={width} value={width}>
                      {width}px
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-muted">
                Line
                <select value={style.dash} onChange={(event) => setStyle({ dash: event.target.value as DrawingStyle["dash"] })} className={`${FIELD} mt-0.5`}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
            </div>
          </>
        ) : null}
        {hasArea || isFib(drawing.tool) || isPosition(drawing.tool) ? (
          <label className="block text-[11px] text-muted">
            Fill opacity {Math.round(style.fill * 100)}%
            <input
              type="range"
              min={0}
              max={60}
              value={Math.round(style.fill * 100)}
              onChange={(event) => setStyle({ fill: Number(event.target.value) / 100 })}
              className="mt-1 w-full accent-[var(--accent-hex)]"
            />
          </label>
        ) : null}
        {detailed ? <div className="border-t border-border pt-2">{renderDetail()}</div> : null}
      </fieldset>
    </section>
  );

  function renderDetail() {
    if (!drawing) return null;
    if (drawing.tool === "text") return <TextEditor id={drawing.id} value={drawing.props.text ?? ""} store={store} />;
    if (isFib(drawing.tool)) return <FibLevelsEditor drawing={drawing} store={store} />;
    return <PositionEditor drawing={drawing} store={store} ctx={ctx} bars={bars()} unit={unit} onSimulate={onSimulate} />;
  }
}

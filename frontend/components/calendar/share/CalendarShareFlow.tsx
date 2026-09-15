"use client";

import clsx from "clsx";
import { Camera, Download, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { captureNodePng, downloadDataUrl } from "@/lib/calendarCapture";
import { api } from "@/lib/api";
import { useGiphy, type GiphyKind, type GiphyMediaItem } from "@/lib/hooks/useGiphy";
import { BUILTIN_STICKERS } from "@/lib/stickers/catalog";
import { useToast } from "@/components/ui/Toast";

export type PlacedSticker = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  z: number;
};

const STAGE_GRADIENT = "linear-gradient(135deg, #6D5BFF 0%, #A855F7 48%, #F472B6 100%)";

export function CalendarCaptureButton({
  onClick,
  capturing,
}: {
  onClick: () => void;
  capturing?: boolean;
}) {
  return (
    <button
      type="button"
      data-capture-hide="true"
      onClick={onClick}
      disabled={capturing}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6B6E78] transition-colors duration-150 hover:bg-[#F4F5F7] hover:text-[#1F2128] disabled:opacity-50"
      aria-label="Capture calendar screenshot"
      title="Screenshot"
    >
      {capturing ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Camera className="h-4 w-4" strokeWidth={1.75} />
      )}
    </button>
  );
}

export function useCalendarShare(filenameStem: string) {
  const toast = useToast();
  const [capturing, setCapturing] = useState(false);
  const [calendarPng, setCalendarPng] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "share" | "style">("idle");

  const open = useCallback(
    async (node: HTMLElement | null) => {
      if (!node) {
        toast.error("Nothing to capture");
        return;
      }
      setCapturing(true);
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const png = await captureNodePng(node);
        setCalendarPng(png);
        setMode("share");
      } catch (err) {
        toast.error("Couldn’t capture calendar", err instanceof Error ? err.message : undefined);
      } finally {
        setCapturing(false);
      }
    },
    [toast]
  );

  const close = useCallback(() => {
    setMode("idle");
  }, []);

  const dialogs =
    calendarPng && mode !== "idle" ? (
      mode === "style" ? (
        <CalendarStyleEditor
          calendarPng={calendarPng}
          filenameStem={filenameStem}
          onClose={close}
        />
      ) : (
        <CalendarShareDialog
          calendarPng={calendarPng}
          filenameStem={filenameStem}
          onClose={close}
          onStyle={() => setMode("style")}
        />
      )
    ) : null;

  return { open, capturing, dialogs };
}

function CalendarShareDialog({
  calendarPng,
  filenameStem,
  onClose,
  onStyle,
}: {
  calendarPng: string;
  filenameStem: string;
  onClose: () => void;
  onStyle: () => void;
}) {
  const toast = useToast();
  const stageRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function save() {
    const node = stageRef.current;
    if (!node) return;
    setSaving(true);
    try {
      const png = await captureNodePng(node);
      downloadDataUrl(png, `${filenameStem}.png`);
      toast.success("Screenshot saved");
      onClose();
    } catch (err) {
      toast.error("Couldn’t save screenshot", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Calendar screenshot"
        className="relative z-10 w-full max-w-[720px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-center justify-between border-b border-[#EEEFF2] px-4 py-3">
          <p className="text-sm font-semibold text-[#1F2128]">Calendar screenshot</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6B6E78] hover:bg-[#F4F5F7]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <ShareStage refNode={stageRef} calendarPng={calendarPng} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EEEFF2] px-4 py-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="dash-btn-secondary !h-9 !px-3 !text-xs disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Save screenshot
          </button>
          <button type="button" onClick={onStyle} className="dash-btn-primary !h-9 !px-3 !text-xs">
            Style screenshot
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CalendarStyleEditor({
  calendarPng,
  filenameStem,
  onClose,
}: {
  calendarPng: string;
  filenameStem: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const stageRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<GiphyKind>("gifs");
  const [query, setQuery] = useState("make it rain");
  const [draft, setDraft] = useState("make it rain");
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const zRef = useRef(1);

  const giphy = useGiphy(kind, query, true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedId) {
          setSelectedId(null);
          return;
        }
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setStickers((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
    }
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose, selectedId]);

  const results = useMemo(() => giphy.data?.items ?? [], [giphy.data]);

  async function addRemote(item: GiphyMediaItem) {
    try {
      const blob = await api.getBlob(`/api/media/proxy?url=${encodeURIComponent(item.url)}`);
      const src = URL.createObjectURL(blob);
      addSticker(src, Math.min(180, item.width || 160));
    } catch (err) {
      toast.error("Couldn’t add GIF", err instanceof Error ? err.message : undefined);
    }
  }

  function addSticker(src: string, width = 120) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    zRef.current += 1;
    setStickers((prev) => [
      ...prev,
      {
        id,
        src,
        x: 12 + Math.random() * 55,
        y: 10 + Math.random() * 45,
        width,
        z: zRef.current,
      },
    ]);
    setSelectedId(id);
  }

  async function download() {
    const node = stageRef.current;
    if (!node) return;
    setSaving(true);
    try {
      setSelectedId(null);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const png = await captureNodePng(node);
      downloadDataUrl(png, `${filenameStem}-styled.png`);
      toast.success("Image downloaded");
    } catch (err) {
      toast.error("Couldn’t download image", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Style screenshot"
        className="relative z-10 grid h-[min(92vh,820px)] w-full max-w-[1180px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.4)] lg:grid-cols-[1fr_340px]"
      >
        <div className="relative min-h-0 bg-[#F7F7FA] p-3 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60 lg:hidden"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <ShareStage
            refNode={stageRef}
            calendarPng={calendarPng}
            stickers={stickers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={setStickers}
          />
        </div>

        <aside className="flex min-h-0 flex-col border-t border-[#EEEFF2] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-sm font-semibold text-[#1F2128]">Style screenshot</p>
            <button
              type="button"
              onClick={onClose}
              className="hidden h-8 w-8 items-center justify-center rounded-md text-[#6B6E78] hover:bg-[#F4F5F7] lg:inline-flex"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 pt-3">
            <button
              type="button"
              onClick={download}
              disabled={saving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#6D5BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5B4696] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Image
            </button>
          </div>

          <div className="mt-4 flex border-b border-[#EEEFF2] px-4">
            {(
              [
                { key: "gifs", label: "GIF" },
                { key: "stickers", label: "Stickers" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setKind(tab.key)}
                className={clsx(
                  "h-10 flex-1 text-[12px] font-semibold uppercase tracking-wider",
                  kind === tab.key
                    ? "border-b-2 border-[#6D5BFF] text-[#6D5BFF]"
                    : "text-[#8B8D96] hover:text-[#1F2128]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(draft.trim());
            }}
          >
            <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-[#E4E5EA] bg-white px-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-[#8B8D96]" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search GIFs"
                className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-[#1F2128] outline-none"
              />
            </div>
            <button type="submit" className="dash-btn-secondary !h-9 !px-3 !text-xs">
              Search
            </button>
          </form>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            {kind === "stickers" && (
              <div className="mb-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#8B8D96]">
                  TradeFix stickers
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {BUILTIN_STICKERS.filter(
                    (sticker) =>
                      !query || sticker.title.toLowerCase().includes(query.toLowerCase())
                  ).map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => addSticker(sticker.src, 96)}
                      className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-[#EEEFF2] bg-[#F7F8FA] hover:border-[#C9CBD4]"
                      title={sticker.title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sticker.src} alt={sticker.title} className="h-12 w-12 object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {giphy.isLoading ? (
              <p className="py-6 text-center text-[13px] text-[#8B8D96]">Searching…</p>
            ) : giphy.isError ? (
              <p className="py-6 text-center text-[13px] text-[#C23B3B]">Couldn’t load GIFs. Try again.</p>
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#8B8D96]">No results</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addRemote(item)}
                    className="overflow-hidden rounded-md bg-[#F3F4F6]"
                    title={item.title}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview_url}
                      alt={item.title}
                      className={clsx(
                        "h-28 w-full",
                        kind === "stickers" ? "object-contain p-1" : "object-cover"
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="px-4 pb-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[#8B8D96]">
            Powered by GIPHY
          </p>
        </aside>
      </div>
    </div>,
    document.body
  );
}

function ShareStage({
  refNode,
  calendarPng,
  stickers = [],
  selectedId = null,
  onSelect,
  onChange,
}: {
  refNode: { current: HTMLDivElement | null };
  calendarPng: string;
  stickers?: PlacedSticker[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (next: PlacedSticker[]) => void;
}) {
  return (
    <div
      ref={(node) => {
        refNode.current = node;
      }}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-xl"
      style={{ background: STAGE_GRADIENT }}
      onPointerDown={() => onSelect?.(null)}
    >
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-[7%] py-[6%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={calendarPng}
          alt="Calendar"
          className="max-h-[78%] w-full rounded-lg object-contain shadow-[0_18px_50px_rgba(30,20,60,0.28)]"
          draggable={false}
        />
        <div className="mt-4 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-full object-contain" />
          <span className="text-[18px] font-bold tracking-tight text-white">
            Trade<span className="text-[#E9D5FF]">Fix</span>
          </span>
        </div>
      </div>
      {stickers.map((sticker) => (
        <PlacedStickerNode
          key={sticker.id}
          sticker={sticker}
          selected={selectedId === sticker.id}
          onSelect={() => onSelect?.(sticker.id)}
          onChange={(next) => onChange?.(stickers.map((s) => (s.id === next.id ? next : s)))}
          onRemove={() => onChange?.(stickers.filter((s) => s.id !== sticker.id))}
        />
      ))}
    </div>
  );
}

function PlacedStickerNode({
  sticker,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  sticker: PlacedSticker;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: PlacedSticker) => void;
  onRemove: () => void;
}) {
  const dragging = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const resizing = useRef<{ x: number; startW: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
    const parent = (e.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect();
    if (!parent) return;
    dragging.current = { x: e.clientX, y: e.clientY, startX: sticker.x, startY: sticker.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const parent = (e.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect();
    if (!parent) return;
    if (resizing.current) {
      const dx = e.clientX - resizing.current.x;
      onChange({ ...sticker, width: Math.max(48, Math.min(280, resizing.current.startW + dx)) });
      return;
    }
    if (!dragging.current) return;
    const dx = ((e.clientX - dragging.current.x) / parent.width) * 100;
    const dy = ((e.clientY - dragging.current.y) / parent.height) * 100;
    onChange({
      ...sticker,
      x: Math.max(-8, Math.min(92, dragging.current.startX + dx)),
      y: Math.max(-8, Math.min(88, dragging.current.startY + dy)),
    });
  }

  function onPointerUp() {
    dragging.current = null;
    resizing.current = null;
  }

  return (
    <div
      className={clsx("absolute cursor-grab touch-none", selected && "cursor-grabbing")}
      style={{ left: `${sticker.x}%`, top: `${sticker.y}%`, width: sticker.width, zIndex: 20 + sticker.z }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sticker.src}
        alt=""
        draggable={false}
        className={clsx("pointer-events-none w-full select-none", selected && "ring-2 ring-white")}
      />
      {selected && (
        <>
          <button
            type="button"
            data-capture-hide="true"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
            aria-label="Remove sticker"
          >
            <X className="h-3 w-3" />
          </button>
          <span
            data-resize-handle="true"
            data-capture-hide="true"
            className="absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-sm bg-white shadow"
            onPointerDown={(e) => {
              e.stopPropagation();
              resizing.current = { x: e.clientX, startW: sticker.width };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!resizing.current) return;
              const dx = e.clientX - resizing.current.x;
              onChange({ ...sticker, width: Math.max(48, Math.min(280, resizing.current.startW + dx)) });
            }}
            onPointerUp={() => {
              resizing.current = null;
            }}
          />
        </>
      )}
    </div>
  );
}

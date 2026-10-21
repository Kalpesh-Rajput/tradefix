import { hitHandle, hitShapes } from "./hit";
import { expandPosition, normalizePosition } from "./metrics";
import { buildShapes } from "./shapes";
import type { DrawingStore } from "./store";
import type { DrawingSurface } from "./surface";
import { defaultProps, defaultStyle, isPosition, toolDef } from "./tools";
import { anchorAt, makeView } from "./view";
import { SCHEMA_VERSION, type Anchor, type Drawing, type DrawingContext, type Pt, type ToolId } from "./types";

export type DrawingScope = {
  symbol: string;
  source: string | null;
  timeframe: string | null;
};

const DRAG_COMPLETE_PX = 8;

type DragState = { id: string; handle: number | "body"; start: Pt; origin: Drawing };

/** Pointer and keyboard state machine. DOM wiring lives in `bindDom`; this class is driven by plain points. */
export class DrawingController {
  private placed: Anchor[] = [];
  private downAt: Pt | null = null;
  private drag: DragState | null = null;

  constructor(
    private readonly surface: DrawingSurface,
    private readonly store: DrawingStore,
    private readonly context: () => DrawingContext,
    private readonly scope: () => DrawingScope
  ) {}

  private inPlot(p: Pt): boolean {
    const { width, height } = this.surface.plotSize();
    return p.x >= 0 && p.y >= 0 && p.x <= width && p.y <= height;
  }

  private view() {
    return makeView(this.surface, this.context());
  }

  private expandForPreview(drawing: Drawing): Drawing {
    if (isPosition(drawing.tool) && drawing.anchors.length === 2) return { ...drawing, anchors: expandPosition(drawing, this.context()) };
    return drawing;
  }

  /** Drawings in paint order, with the live draft last. */
  paintList(): Drawing[] {
    const list = this.store.hiddenAll ? [] : this.store.drawings.filter((item) => item.visible);
    const draft = this.store.draft;
    return draft ? [...list, this.expandForPreview(draft)] : list;
  }

  private startDraft(tool: ToolId, first: Anchor) {
    const accent = this.surface.theme().accent;
    const { symbol, source, timeframe } = this.scope();
    const draft: Drawing = {
      id: this.store.newDrawingId(),
      tool,
      symbol,
      source,
      timeframe,
      anchors: [first, { ...first }],
      style: defaultStyle(tool, accent),
      props: defaultProps(tool),
      visible: true,
      locked: false,
      z: 0,
      schemaVersion: SCHEMA_VERSION,
    };
    this.store.setDraft(draft);
  }

  private finishDraft() {
    const draft = this.store.draft;
    if (!draft) return;
    const ctx = this.context();
    let anchors = this.placed;
    if (isPosition(draft.tool)) anchors = expandPosition({ ...draft, anchors }, ctx);
    this.placed = [];
    this.downAt = null;
    this.store.setDraft(null);
    this.store.setTool(null);
    this.store.add({ ...draft, anchors });
  }

  private placeAnchor(anchor: Anchor) {
    const tool = this.store.activeTool;
    if (!tool) return;
    const clicks = toolDef(tool).clicks;
    this.placed = [...this.placed, anchor];
    if (this.placed.length >= clicks) {
      this.finishDraft();
      return;
    }
    const draft = this.store.draft;
    if (!draft) {
      this.startDraft(tool, anchor);
      return;
    }
    this.store.setDraft({ ...draft, anchors: [...this.placed, { ...anchor }] });
  }

  pointerDown(p: Pt): boolean {
    if (!this.inPlot(p)) return false;
    const tool = this.store.activeTool;
    if (tool) {
      const anchor = anchorAt(this.surface, this.context(), p);
      if (!anchor) return true;
      this.downAt = p;
      if (!this.store.draft) {
        this.placed = [];
        this.startDraft(tool, anchor);
      }
      this.placeAnchor(anchor);
      return true;
    }
    return this.beginSelectOrDrag(p);
  }

  private beginSelectOrDrag(p: Pt): boolean {
    const view = this.view();
    const selected = this.store.selectedDrawing;
    if (selected && selected.visible && !selected.locked && !this.store.hiddenAll) {
      const handles = buildShapes(selected, view).handles;
      const handle = hitHandle(handles, p);
      if (handle >= 0) {
        this.startDrag(selected, handle, p);
        return true;
      }
    }
    const list = this.store.hiddenAll ? [] : this.store.drawings;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const item = list[i];
      if (!item.visible) continue;
      if (hitShapes(buildShapes(item, view).shapes, p)) {
        this.store.select(item.id);
        if (!item.locked) this.startDrag(item, "body", p);
        return true;
      }
    }
    if (this.store.selectedId) this.store.select(null);
    return false;
  }

  private startDrag(drawing: Drawing, handle: number | "body", start: Pt) {
    this.drag = { id: drawing.id, handle, start, origin: drawing };
    this.store.beginDrag();
  }

  private moved(origin: Drawing, handle: number | "body", p: Pt, start: Pt): Anchor[] | null {
    const view = this.view();
    const ctx = this.context();
    if (handle === "body") {
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const next: Anchor[] = [];
      for (const anchor of origin.anchors) {
        const point = view.point(anchor);
        const moved = point ? anchorAt(this.surface, ctx, { x: point.x + dx, y: point.y + dy }) : null;
        if (!moved) return null;
        next.push(moved);
      }
      return next;
    }
    const target = anchorAt(this.surface, ctx, p);
    if (!target) return null;
    const next = origin.anchors.map((anchor) => ({ ...anchor }));
    if (isPosition(origin.tool) && handle > 0) {
      next[1] = { t: target.t, p: handle === 1 ? target.p : next[1].p };
      next[2] = { t: target.t, p: handle === 2 ? target.p : next[2].p };
    } else next[handle] = target;
    return isPosition(origin.tool) ? normalizePosition({ ...origin, anchors: next }, ctx) : next;
  }

  pointerMove(p: Pt): string {
    const draft = this.store.draft;
    if (draft) {
      const anchor = anchorAt(this.surface, this.context(), p);
      if (anchor) this.store.setDraft({ ...draft, anchors: [...this.placed, anchor] });
      return "crosshair";
    }
    if (this.store.activeTool) return "crosshair";
    if (this.drag) {
      const next = this.moved(this.drag.origin, this.drag.handle, p, this.drag.start);
      if (next) this.store.dragTo(this.drag.id, { anchors: next });
      return "move";
    }
    if (!this.inPlot(p)) return "";
    const view = this.view();
    const selected = this.store.selectedDrawing;
    if (selected && !selected.locked && selected.visible && hitHandle(buildShapes(selected, view).handles, p) >= 0) return "pointer";
    const list = this.store.hiddenAll ? [] : this.store.drawings;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].visible && hitShapes(buildShapes(list[i], view).shapes, p)) return list[i].locked ? "not-allowed" : "move";
    }
    return "";
  }

  pointerUp(p: Pt): boolean {
    if (this.drag) {
      this.drag = null;
      this.store.endDrag();
      return true;
    }
    const draft = this.store.draft;
    const tool = this.store.activeTool;
    if (draft && tool && this.downAt && this.placed.length === 1 && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > DRAG_COMPLETE_PX) {
      const anchor = anchorAt(this.surface, this.context(), p);
      if (anchor) this.placeAnchor(anchor);
      return true;
    }
    return false;
  }

  cancel(): boolean {
    if (this.drag) {
      this.drag = null;
      this.store.cancelDrag();
      return true;
    }
    if (this.store.draft) {
      this.placed = [];
      this.store.setDraft(null);
      this.store.setTool(null);
      return true;
    }
    if (this.store.activeTool) {
      this.store.setTool(null);
      return true;
    }
    if (this.store.selectedId) {
      this.store.select(null);
      return true;
    }
    return false;
  }

  deleteSelected(): boolean {
    const selected = this.store.selectedDrawing;
    if (!selected || selected.locked) return false;
    this.store.remove(selected.id);
    return true;
  }

  get busy(): boolean {
    return this.drag !== null || this.store.draft !== null;
  }
}

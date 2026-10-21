import type { DrawingController } from "./controller";
import { paintHandles, paintShapes } from "./render";
import { buildShapes } from "./shapes";
import type { DrawingStore } from "./store";
import type { DrawingSurface } from "./surface";
import { TOOLS } from "./tools";
import { makeView } from "./view";
import type { DrawingContext, Pt } from "./types";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

/** Wires a controller to the chart's DOM and canvas. Everything it adds is removed by the returned function. */
export function bindDrawings(
  surface: DrawingSurface,
  store: DrawingStore,
  controller: DrawingController,
  context: () => DrawingContext
): () => void {
  const el = surface.container;  let swallow = false;
  let capturedPointer: number | null = null;

  const local = (event: PointerEvent): Pt => {
    const box = el.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const painter = surface.attachPainter((ctx, width, height) => {
    const list = controller.paintList();
    if (!list.length) return;
    const view = makeView(surface, context());
    view.width = width;
    view.height = height;
    const selectedId = store.selectedId;
    for (const drawing of list) {
      const built = buildShapes(drawing, view);
      const isDraft = drawing.id === store.draft?.id;
      paintShapes(ctx, built.shapes, isDraft ? 0.85 : 1);
      if (drawing.id === selectedId && !drawing.locked) paintHandles(ctx, built.handles, drawing.style.color, view.theme.background);
      else if (isDraft) paintHandles(ctx, built.handles.slice(0, -1), drawing.style.color, view.theme.background);
    }
  });
  const stopPaint = store.subscribePaint(() => painter.requestRepaint());

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || (event.pointerType === "mouse" && event.buttons > 1)) return;
    if (!controller.pointerDown(local(event))) return;
    swallow = true;
    event.preventDefault();
    event.stopPropagation();
    try {
      el.setPointerCapture(event.pointerId);
      capturedPointer = event.pointerId;
    } catch {
      capturedPointer = null;
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    const cursor = controller.pointerMove(local(event));
    el.style.cursor = cursor;
    if (swallow || controller.busy) event.stopPropagation();
  };
  const onPointerUp = (event: PointerEvent) => {
    const consumed = controller.pointerUp(local(event));
    if (swallow || consumed) event.stopPropagation();
    swallow = false;
    if (capturedPointer !== null) {
      try {
        el.releasePointerCapture(capturedPointer);
      } catch {
        /* already released */
      }
      capturedPointer = null;
    }
  };
  const stopCompat = (event: Event) => {
    if (swallow) event.stopPropagation();
  };

  el.addEventListener("pointerdown", onPointerDown, true);
  el.addEventListener("pointermove", onPointerMove, true);
  el.addEventListener("pointerup", onPointerUp, true);
  el.addEventListener("pointercancel", onPointerUp, true);
  el.addEventListener("mousedown", stopCompat, true);
  el.addEventListener("touchstart", stopCompat, true);

  const onKey = (event: KeyboardEvent) => {
    if (isTyping(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    let handled = false;
    if (event.key === "Escape") handled = controller.cancel();
    else if ((event.key === "Delete" || event.key === "Backspace") && !mod) handled = controller.deleteSelected();
    else if (mod && event.key.toLowerCase() === "z") {
      if (event.shiftKey) store.redo();
      else store.undo();
      handled = true;
    } else if (mod && event.key.toLowerCase() === "y") {
      store.redo();
      handled = true;
    } else if (event.altKey && !mod) {
      const tool = TOOLS.find((item) => item.shortcut && `Key${item.shortcut}` === event.code);
      if (tool) {
        store.setTool(store.activeTool === tool.id ? null : tool.id);
        handled = true;
      }
    }
    if (handled) event.preventDefault();
  };
  window.addEventListener("keydown", onKey);

  return () => {
    el.removeEventListener("pointerdown", onPointerDown, true);
    el.removeEventListener("pointermove", onPointerMove, true);
    el.removeEventListener("pointerup", onPointerUp, true);
    el.removeEventListener("pointercancel", onPointerUp, true);
    el.removeEventListener("mousedown", stopCompat, true);
    el.removeEventListener("touchstart", stopCompat, true);
    window.removeEventListener("keydown", onKey);
    el.style.cursor = "";
    stopPaint();
    painter.detach();
  };
}

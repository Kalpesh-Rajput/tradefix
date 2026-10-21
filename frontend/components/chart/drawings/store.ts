import { cloneDrawing } from "./tools";
import type { Drawing, ToolId } from "./types";

const HISTORY_LIMIT = 100;

export type DirtySet = { upserts: Drawing[]; deletes: string[] };

/**
 * Framework-free drawing state. `subscribe` fires on structural changes (React reads these);
 * `subscribePaint` additionally fires on previews and drags (the canvas reads these).
 */
export class DrawingStore {
  private items: Drawing[] = [];
  private past: Drawing[][] = [];
  private future: Drawing[][] = [];
  private upserts = new Set<string>();
  private deletes = new Set<string>();
  private stateListeners = new Set<() => void>();
  private paintListeners = new Set<() => void>();
  private version = 0;
  private selected: string | null = null;
  private tool: ToolId | null = null;
  private draftValue: Drawing | null = null;
  private dragging = false;
  private allHidden = false;
  private dragBase: Drawing[] | null = null;

  constructor(private readonly newId: () => string = () => crypto.randomUUID()) {}

  get drawings(): readonly Drawing[] {
    return this.items;
  }
  get selectedId(): string | null {
    return this.selected;
  }
  get selectedDrawing(): Drawing | null {
    return this.items.find((item) => item.id === this.selected) ?? null;
  }
  get activeTool(): ToolId | null {
    return this.tool;
  }
  get draft(): Drawing | null {
    return this.draftValue;
  }
  get isDragging(): boolean {
    return this.dragging;
  }
  get hiddenAll(): boolean {
    return this.allHidden;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  getVersion(): number {
    return this.version;
  }

  subscribe(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribePaint(listener: () => void): () => void {
    this.paintListeners.add(listener);
    return () => this.paintListeners.delete(listener);
  }

  private emit(structural: boolean) {
    if (structural) {
      this.version += 1;
      for (const listener of this.stateListeners) listener();
    }
    for (const listener of this.paintListeners) listener();
  }

  /** Replace everything from the server. Not undoable and not dirty. */
  hydrate(items: readonly Drawing[]) {
    this.items = [...items].sort((a, b) => a.z - b.z);
    this.past = [];
    this.future = [];
    this.upserts.clear();
    this.deletes.clear();
    this.selected = null;
    this.draftValue = null;
    this.emit(true);
  }

  private commit(next: Drawing[], record: boolean) {
    const previous = this.items;
    if (record) {
      this.past.push(previous);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.future = [];
    }
    this.markDiff(previous, next);
    this.items = next;
    if (this.selected && !next.some((item) => item.id === this.selected)) this.selected = null;
    this.emit(true);
  }

  private markDiff(previous: readonly Drawing[], next: readonly Drawing[]) {
    const before = new Map(previous.map((item) => [item.id, item]));
    const after = new Set(next.map((item) => item.id));
    for (const item of next) {
      if (before.get(item.id) !== item) {
        this.upserts.add(item.id);
        this.deletes.delete(item.id);
      }
    }
    for (const id of before.keys()) {
      if (!after.has(id)) {
        this.upserts.delete(id);
        this.deletes.add(id);
      }
    }
  }

  add(drawing: Drawing): Drawing {
    const placed = { ...drawing, z: (this.items.at(-1)?.z ?? 0) + 1 };
    this.selected = placed.id;
    this.commit([...this.items, placed], true);
    return placed;
  }

  patch(id: string, change: Partial<Omit<Drawing, "id">>) {
    if (!this.items.some((item) => item.id === id)) return;
    this.commit(this.items.map((item) => (item.id === id ? { ...item, ...change } : item)), true);
  }

  remove(id: string) {
    if (!this.items.some((item) => item.id === id)) return;
    this.commit(this.items.filter((item) => item.id !== id), true);
  }

  clear() {
    if (!this.items.length) return;
    this.commit([], true);
  }

  /** `shift` moves the copy so it does not hide the original. */
  duplicate(id: string, shift: { t: number; p: number } = { t: 0, p: 0 }): Drawing | null {
    const source = this.items.find((item) => item.id === id);
    if (!source) return null;
    const copy = cloneDrawing(source, this.newId());
    copy.locked = false;
    copy.anchors = copy.anchors.map((anchor) => ({ t: anchor.t + shift.t, p: anchor.p + shift.p }));
    return this.add(copy);
  }

  newDrawingId(): string {
    return this.newId();
  }

  undo() {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.items);
    this.markDiff(this.items, previous);
    this.items = previous;
    if (this.selected && !previous.some((item) => item.id === this.selected)) this.selected = null;
    this.emit(true);
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.items);
    this.markDiff(this.items, next);
    this.items = next;
    if (this.selected && !next.some((item) => item.id === this.selected)) this.selected = null;
    this.emit(true);
  }

  select(id: string | null) {
    if (this.selected === id) return;
    this.selected = id;
    this.emit(true);
  }

  setTool(tool: ToolId | null) {
    this.tool = tool;
    this.draftValue = null;
    if (tool) this.selected = null;
    this.emit(true);
  }

  setDraft(draft: Drawing | null) {
    const structural = (this.draftValue === null) !== (draft === null);
    this.draftValue = draft;
    this.emit(structural);
  }

  setHiddenAll(hidden: boolean) {
    this.allHidden = hidden;
    this.emit(true);
  }

  /** Live drag: no history, no persistence until `endDrag`. */
  beginDrag() {
    this.dragging = true;
    this.dragBase = this.items;
  }

  dragTo(id: string, change: Partial<Omit<Drawing, "id">>) {
    this.items = this.items.map((item) => (item.id === id ? { ...item, ...change } : item));
    this.emit(false);
  }

  endDrag() {
    const base = this.dragBase;
    this.dragging = false;
    this.dragBase = null;
    if (!base || base === this.items) return;
    const final = this.items;
    this.items = base;
    this.commit(final, true);
  }

  cancelDrag() {
    if (this.dragBase) this.items = this.dragBase;
    this.dragging = false;
    this.dragBase = null;
    this.emit(true);
  }

  hasDirty(): boolean {
    return this.upserts.size > 0 || this.deletes.size > 0;
  }

  takeDirty(): DirtySet {
    const upserts = this.items.filter((item) => this.upserts.has(item.id));
    const deletes = [...this.deletes];
    this.upserts.clear();
    this.deletes.clear();
    return { upserts, deletes };
  }

  /** Put a failed batch back so the next save retries it. */
  restoreDirty(batch: DirtySet) {
    for (const item of batch.upserts) if (this.items.some((current) => current.id === item.id)) this.upserts.add(item.id);
    for (const id of batch.deletes) if (!this.items.some((current) => current.id === id)) this.deletes.add(id);
  }
}

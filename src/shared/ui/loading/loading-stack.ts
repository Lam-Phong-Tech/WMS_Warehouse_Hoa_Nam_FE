/** Child effects commit first: nesting depth, not effect order, owns overlays. */
export class LoadingOverlayStack {
  private entries: Array<{ id: string; depth: number; order: number }> = [];
  private order = 0;
  private readonly listeners = new Set<() => void>();
  getSnapshot = (): string | undefined => {
    let top: { id: string; depth: number; order: number } | undefined;
    for (const entry of this.entries) {
      if (!top || entry.depth > top.depth || (entry.depth === top.depth && entry.order > top.order)) top = entry;
    }
    return top?.id;
  };
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  add(id: string, depth: number): () => void {
    this.entries = [...this.entries.filter((entry) => entry.id !== id), { id, depth, order: ++this.order }];
    this.notify();
    return () => { this.entries = this.entries.filter((entry) => entry.id !== id); this.notify(); };
  }
  private notify(): void { for (const listener of this.listeners) listener(); }
}

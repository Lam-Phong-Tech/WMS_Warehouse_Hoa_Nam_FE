/** A render barrier, not a request queue: all reads continue in parallel. */
export interface LoadingRead {
  active: boolean;
  hasData: boolean;
  fetchStatus: "idle" | "fetching" | "paused";
  background?: boolean;
}
export type LoadingPhase = "loading" | "offline" | "ready";
export interface LoadingSnapshot {
  readonly phase: LoadingPhase;
  readonly initial: boolean;
}
export interface LoadingEnvironment {
  reads: () => readonly LoadingRead[];
  covered: () => boolean;
  nextFrame: (callback: () => void) => () => void;
}
/** Isolated per surface. No fabricated percentages or minimum-duration timeout. */
export class LoadingController {
  private readonly environment: LoadingEnvironment;
  private readonly listeners = new Set<() => void>();
  private readonly participants = new Set<string>();
  private snapshot: LoadingSnapshot = { phase: "loading", initial: true };
  private revealed = false;
  private batch = false;
  private active = false;
  private cancelFrame: (() => void) | undefined;
  constructor(environment: LoadingEnvironment) { this.environment = environment; }
  getSnapshot = (): LoadingSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  activate = (): void => { this.active = true; this.refresh(); };
  deactivate = (): void => { this.active = false; this.cancelSettlement(); };
  setParticipant = (id: string, pending: boolean): void => {
    if (pending === this.participants.has(id)) return;
    if (pending) this.participants.add(id);
    else this.participants.delete(id);
    this.refresh();
  };
  /** Arm before a filter/refresh handler. A validation-only click shows no loader. */
  beginBatch = (): void => { this.batch = true; this.refresh(); };
  private pendingPhase(): Exclude<LoadingPhase, "ready"> | null {
    if (this.revealed && this.environment.covered()) return null;
    const reads = this.environment.reads().filter((read) =>
      read.active && !read.background && (!this.revealed || this.batch || !read.hasData),
    );
    const fetching = reads.some((read) => read.fetchStatus === "fetching");
    const paused = reads.some((read) => read.fetchStatus === "paused" && !read.hasData);
    if (fetching) return "loading";
    // A complete cached snapshot remains usable offline; a missing one does not.
    if (paused) return "offline";
    if (this.participants.size > 0) return "loading";
    return null;
  }
  refresh = (): void => {
    if (!this.active) return;
    const pending = this.pendingPhase();
    if (pending !== null) { this.cancelSettlement(); this.publish(pending); return; }
    if (this.snapshot.phase === "ready" && !this.batch) return;
    if (this.cancelFrame) return;
    // Allow query notifications and dependent effects to commit before revealing.
    // These are render opportunities, not a cosmetic delay.
    this.cancelFrame = this.environment.nextFrame(() => {
      this.cancelFrame = undefined;
      if (!this.active) return;
      if (this.pendingPhase() !== null) { this.refresh(); return; }
      this.cancelFrame = this.environment.nextFrame(() => {
        this.cancelFrame = undefined;
        if (!this.active) return;
        if (this.pendingPhase() !== null) { this.refresh(); return; }
        this.revealed = true; this.batch = false; this.publish("ready");
      });
    });
  };
  private cancelSettlement(): void { this.cancelFrame?.(); this.cancelFrame = undefined; }
  private publish(phase: LoadingPhase): void {
    const initial = !this.revealed;
    if (this.snapshot.phase === phase && this.snapshot.initial === initial) return;
    this.snapshot = { phase, initial };
    for (const listener of this.listeners) listener();
  }
}

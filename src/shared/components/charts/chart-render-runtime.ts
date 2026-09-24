/** Promise-backed drawing. No DOM, timers, data fetching or synthetic progress. */
export interface ChartDriver<T> {
  render: () => unknown | PromiseLike<unknown>;
  update: (input: T) => unknown | PromiseLike<unknown>;
  destroy: () => void;
}
interface Draw<T> {
  revision: number;
  input: T;
  ready: () => void;
  failed: (error: unknown) => void;
}
export interface ChartRuntimeOptions<T> {
  create: (input: T) => ChartDriver<T>;
  equal: (left: T, right: T) => boolean;
  copy: (input: T) => T;
}

/**
 * Only one engine draw may run at a time. Intermediate pending inputs are
 * coalesced; only the latest committed revision can acknowledge readiness.
 * This avoids relying on lifecycle events that read mutable engine config.
 */
export function createChartRenderRuntime<T>(options: ChartRuntimeOptions<T>) {
  let driver: ChartDriver<T> | undefined;
  let previous: { input: T } | undefined;
  let pending: Draw<T> | undefined;
  let revision = 0;
  let running = false;
  let disposed = false;

  const destroyDriver = () => {
    const old = driver;
    driver = undefined;
    previous = undefined;
    // A rejected or detached SVG may also fail teardown. It must not prevent
    // releasing the presentation scope, nor hide the original drawing error.
    try { old?.destroy(); } catch { /* already detached */ }
  };

  const drain = async () => {
    if (running || disposed) return;
    running = true;
    try {
      while (pending && !disposed) {
        const draw = pending;
        pending = undefined;
        try {
          if (!driver) {
            driver = options.create(options.copy(draw.input));
            await driver.render();
          } else if (!previous || !options.equal(previous.input, draw.input)) {
            await driver.update(options.copy(draw.input));
          }
          if (disposed) return;
          previous = { input: draw.input };
          if (draw.revision === revision) draw.ready();
        } catch (error) {
          destroyDriver();
          if (!disposed && draw.revision === revision) draw.failed(error);
        }
      }
    } finally {
      running = false;
    }
  };

  return {
    draw(input: T, ready: () => void, failed: (error: unknown) => void) {
      if (disposed) return;
      // Snapshot before any async work. Engine mutation cannot alter the
      // caller's options/series or the snapshot used for equality checks.
      pending = { revision: ++revision, input: options.copy(input), ready, failed };
      void drain();
    },
    dispose() {
      disposed = true;
      pending = undefined;
      revision += 1;
      destroyDriver();
    },
  };
}

/** Compare config values, preserving callback identity and Date semantics. */
export function equalChartConfig(
  left: unknown,
  right: unknown,
  seen = new WeakMap<object, WeakSet<object>>(),
): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  const prototype = Object.getPrototypeOf(left);
  if (!Array.isArray(left) && prototype !== Object.prototype && prototype !== null) return false;
  if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) return false;
  if (seen.get(left)?.has(right)) return true;
  const partners = seen.get(left) ?? new WeakSet<object>();
  partners.add(right);
  seen.set(left, partners);
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(right, key) && equalChartConfig(a[key], b[key], seen),
  );
}

/** Clone plain config/series only; callbacks and non-plain objects stay intact. */
export function copyChartConfig<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (seen.has(value)) return seen.get(value) as T;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
  const result: Record<string, unknown> = Array.isArray(value)
    ? new Array(value.length) as unknown as Record<string, unknown>
    : Object.create(prototype) as Record<string, unknown>;
  seen.set(value, result);
  for (const key of Object.keys(value)) {
    Object.defineProperty(result, key, {
      value: copyChartConfig((value as Record<string, unknown>)[key], seen),
      enumerable: true, writable: true, configurable: true,
    });
  }
  return result as T;
}

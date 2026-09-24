import { it as test } from "vitest";
import assert from "node:assert/strict";
import { createChartRenderRuntime, copyChartConfig, equalChartConfig } from "./chart-render-runtime";
import { LoadingController, type LoadingRead } from "../../ui/loading/loading-controller";
import { createChartRenderCycle } from "../../ui/loading/chart-render-cycle";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function unexpected(error: unknown): never { throw error; }
async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }
function harness() {
  const work: ReturnType<typeof deferred>[] = [];
  const calls: string[] = [];
  const runtime = createChartRenderRuntime<{ value: number }>({
    create: (input) => {
      calls.push(`create:${input.value}`);
      return {
        render: () => { const task = deferred(); work.push(task); calls.push("render"); return task.promise; },
        update: (next) => { const task = deferred(); work.push(task); calls.push(`update:${next.value}`); return task.promise; },
        destroy: () => { calls.push("destroy"); },
      };
    },
    equal: equalChartConfig,
    copy: copyChartConfig,
  });
  const ready: number[] = [];
  const failures: unknown[] = [];
  const draw = (value: number) => runtime.draw({ value }, () => ready.push(value), (error) => failures.push(error));
  return { work, calls, ready, failures, draw, runtime };
}
function gate() {
  let reads: LoadingRead[] = [];
  let serial = 0;
  let covered = false;
  const frames = new Map<number, () => void>();
  const controller = new LoadingController({
    reads: () => reads, covered: () => covered,
    nextFrame: (fn) => { const id = ++serial; frames.set(id, fn); return () => { frames.delete(id); }; },
  });
  controller.activate();
  return {
    controller,
    phase: () => controller.getSnapshot().phase,
    reads: (value: LoadingRead[]) => { reads = value; controller.refresh(); },
    cover: (value: boolean) => { covered = value; controller.refresh(); },
    settle: () => { for (let i = 0; i < 4; i += 1) { const tasks = [...frames.values()]; frames.clear(); tasks.forEach((fn) => fn()); } },
  };
}
const fetched: LoadingRead = { active: true, hasData: true, fetchStatus: "idle" };

test("a mounted engine is not ready until its render promise resolves", async () => {
  const h = harness(); h.draw(1); await flush(); assert.deepEqual(h.ready, []);
  h.work[0].resolve(); await flush(); assert.deepEqual(h.ready, [1]);
});
test("updates wait for the pending initial draw instead of overlapping SVG work", async () => {
  const h = harness(); h.draw(1); h.draw(2); await flush();
  assert.deepEqual(h.calls, ["create:1", "render"]);
  h.work[0].resolve(); await flush(); assert.deepEqual(h.ready, []);
  assert.equal(h.calls.at(-1), "update:2");
  h.work[1].resolve(); await flush(); assert.deepEqual(h.ready, [2]);
});
test("rapid filter revisions coalesce to the latest pending draw", async () => {
  const h = harness(); h.draw(1); h.draw(2); h.draw(3);
  h.work[0].resolve(); await flush(); assert.equal(h.calls.at(-1), "update:3");
  assert.ok(!h.calls.includes("update:2"));
  h.work[1].resolve(); await flush(); assert.deepEqual(h.ready, [3]);
});
test("an older update cannot announce readiness for the newest data", async () => {
  const h = harness(); h.draw(1); h.work[0].resolve(); await flush();
  h.draw(2); h.draw(3); h.work[1].resolve(); await flush();
  assert.deepEqual(h.ready, [1]); h.work[2].resolve(); await flush(); assert.deepEqual(h.ready, [1, 3]);
});
test("equal data acknowledges its revision without a needless redraw or remount", async () => {
  const h = harness(); h.draw(1); h.work[0].resolve(); await flush(); h.draw(1); await flush();
  assert.deepEqual(h.ready, [1, 1]); assert.deepEqual(h.calls, ["create:1", "render"]);
});
test("a rejected render becomes a settled error, never fake success", async () => {
  const h = harness(); const error = new Error("SVG unavailable");
  h.draw(1); h.work[0].reject(error); await flush();
  assert.deepEqual(h.failures, [error]); assert.deepEqual(h.ready, []); assert.equal(h.calls.at(-1), "destroy");
});
test("a rejected update also disposes the broken renderer", async () => {
  const h = harness(); h.draw(1); h.work[0].resolve(); await flush(); h.draw(2);
  const error = new Error("update failed"); h.work[1].reject(error); await flush();
  assert.deepEqual(h.ready, [1]); assert.deepEqual(h.failures, [error]); assert.equal(h.calls.at(-1), "destroy");
});
test("a stale failed draw cannot replace a newer successful revision with an error", async () => {
  const h = harness(); h.draw(1); h.draw(2); h.work[0].reject(new Error("obsolete")); await flush();
  assert.deepEqual(h.failures, []); assert.equal(h.calls.at(-2), "create:2");
  h.work[1].resolve(); await flush(); assert.deepEqual(h.ready, [2]);
});
test("synchronous renderer construction failure is caught", async () => {
  const error = new Error("constructor"); const outcomes: unknown[] = [];
  const runtime = createChartRenderRuntime<number>({
    create: () => { throw error; }, equal: Object.is, copy: (value) => value,
  });
  runtime.draw(1, () => outcomes.push("wrong"), (value) => outcomes.push(value)); await flush();
  assert.deepEqual(outcomes, [error]);
});
test("synchronous render failure retains the original error even if cleanup fails", async () => {
  const error = new Error("render"); const outcomes: unknown[] = [];
  const runtime = createChartRenderRuntime<number>({
    create: () => ({ render: () => { throw error; }, update: () => {}, destroy: () => { throw new Error("cleanup"); } }),
    equal: Object.is, copy: (value) => value,
  });
  runtime.draw(1, () => outcomes.push("wrong"), (value) => outcomes.push(value)); await flush();
  assert.deepEqual(outcomes, [error]);
});
test("closing a loading chart suppresses late success and queued work", async () => {
  const h = harness(); h.draw(1); h.draw(2); h.runtime.dispose(); h.work[0].resolve(); await flush();
  assert.deepEqual(h.ready, []); assert.deepEqual(h.failures, []); assert.ok(!h.calls.includes("update:2"));
});
test("closing a chart suppresses late rejection", async () => {
  const h = harness(); h.draw(1); h.runtime.dispose(); h.work[0].reject(new Error("late")); await flush();
  assert.deepEqual(h.failures, []); assert.deepEqual(h.ready, []);
});
test("disposal is idempotent and prevents new engine work", async () => {
  const h = harness(); h.draw(1); h.runtime.dispose(); h.runtime.dispose(); h.draw(2);
  h.work[0].resolve(); await flush(); assert.equal(h.calls.filter((x) => x === "destroy").length, 1);
});
test("StrictMode/Activity replacement ignores the old runtime", async () => {
  const old = harness(), next = harness(); old.draw(1); old.runtime.dispose(); next.draw(2);
  old.work[0].resolve(); await flush(); assert.deepEqual(old.ready, []); assert.deepEqual(next.ready, []);
  next.work[0].resolve(); await flush(); assert.deepEqual(next.ready, [2]);
});
test("engine mutation cannot change the source data or defeat equal-data detection", async () => {
  const input = { series: [{ data: [1, 2] }] }; let creates = 0, updates = 0, ready = 0;
  const runtime = createChartRenderRuntime<typeof input>({
    create: (value) => { creates += 1; value.series[0].data[0] = 999; return { render: () => {}, update: () => { updates += 1; }, destroy: () => {} }; },
    equal: equalChartConfig, copy: copyChartConfig,
  });
  runtime.draw(input, () => { ready += 1; }, unexpected); await flush();
  runtime.draw(input, () => { ready += 1; }, unexpected); await flush();
  assert.deepEqual(input.series[0].data, [1, 2]); assert.equal(creates, 1); assert.equal(updates, 0); assert.equal(ready, 2);
});
test("queued input is snapshotted before the caller mutates its object", async () => {
  const first = deferred(); const values: number[] = [];
  const runtime = createChartRenderRuntime<{ value: number }>({
    create: () => ({ render: () => first.promise, update: (next) => { values.push(next.value); }, destroy: () => {} }),
    equal: equalChartConfig, copy: copyChartConfig,
  });
  runtime.draw({ value: 1 }, () => {}, unexpected);
  const queued = { value: 2 }; runtime.draw(queued, () => {}, unexpected); queued.value = 99;
  first.resolve(); await flush(); assert.deepEqual(values, [2]);
});
test("config cloning preserves callbacks, dates, cycles and sparse arrays", () => {
  const callback = () => 1; const input: Record<string, unknown> = { callback, date: new Date(0), values: new Array(3) };
  input.self = input; const result = copyChartConfig(input);
  assert.notEqual(result, input); assert.equal(result.callback, callback); assert.notEqual(result.date, input.date);
  assert.equal(result.self, result); assert.equal((result.values as unknown[]).length, 3); assert.ok(equalChartConfig(input, result));
});
test("config comparison detects function, missing-key, length and Date changes", () => {
  assert.ok(!equalChartConfig({ f: () => 1 }, { f: () => 1 }));
  assert.ok(!equalChartConfig({}, { missing: undefined }));
  assert.ok(!equalChartConfig(new Array(2), new Array(3)));
  assert.ok(!equalChartConfig(new Date(0), new Date(1)));
  assert.ok(equalChartConfig({ value: NaN }, { value: NaN }));
});

test("API-ready KPI and table remain gated until BOTH chart promises settle", async () => {
  const g = gate(), a = harness(), b = harness();
  const first = createChartRenderCycle(g.controller, "first", { current: null });
  const second = createChartRenderCycle(g.controller, "second", { current: null });
  first.activate(); second.activate();
  a.runtime.draw({ value: 1 }, first.complete, unexpected);
  b.runtime.draw({ value: 2 }, second.complete, unexpected);
  g.reads([fetched, fetched]); a.work[0].resolve(); await flush(); g.settle(); assert.equal(g.phase(), "loading");
  b.work[0].resolve(); await flush(); g.settle(); assert.equal(g.phase(), "ready");
});
test("an earlier background draw joins a later real foreground read", () => {
  const g = gate(); g.reads([fetched]); g.settle();
  const draw = createChartRenderCycle(g.controller, "chart", { current: null });
  draw.activate(true, "foreground"); assert.equal(g.phase(), "ready");
  g.controller.beginBatch(); g.reads([{ ...fetched, fetchStatus: "fetching" }]);
  g.reads([fetched]); g.settle(); assert.equal(g.phase(), "loading");
  draw.complete(); g.settle(); assert.equal(g.phase(), "ready");
});
test("validation-only clicks during a background draw do not hide a ready page", () => {
  const g = gate(); g.settle(); g.controller.setParticipant("draw", true, "foreground");
  g.controller.beginBatch(); g.settle(); assert.equal(g.phase(), "ready");
  g.controller.setParticipant("draw", false); g.settle(); assert.equal(g.phase(), "ready");
});
test("foreground-only preparation still blocks an initial screen", () => {
  const g = gate(); g.controller.setParticipant("draw", true, "foreground"); g.settle(); assert.equal(g.phase(), "loading");
  g.controller.setParticipant("draw", false); g.settle(); assert.equal(g.phase(), "ready");
});
test("a failed chart releases only its ticket, not another unfinished chart", async () => {
  const g = gate(), a = harness(), b = harness(); let errors = 0;
  const first = createChartRenderCycle(g.controller, "first", { current: null });
  const second = createChartRenderCycle(g.controller, "second", { current: null });
  first.activate(); second.activate();
  a.runtime.draw({ value: 1 }, first.complete, () => { errors += 1; first.dispose(); });
  b.runtime.draw({ value: 2 }, second.complete, unexpected);
  a.work[0].reject(new Error("unavailable")); await flush(); g.settle(); assert.equal(g.phase(), "loading");
  b.work[0].resolve(); await flush(); g.settle(); assert.equal(g.phase(), "ready"); assert.equal(errors, 1);
});
test("a dialog-covered ready page is not hidden by background chart work", () => {
  const g = gate(); g.settle(); g.cover(true);
  g.controller.setParticipant("chart", true, "foreground"); g.controller.beginBatch(); g.settle(); assert.equal(g.phase(), "ready");
  g.controller.setParticipant("chart", false); g.cover(false); g.settle(); assert.equal(g.phase(), "ready");
});
test("paused no-data reads show offline, not an endless chart spinner", () => {
  const g = gate(); g.controller.setParticipant("chart", true);
  g.reads([{ active: true, hasData: false, fetchStatus: "paused" }]); g.settle(); assert.equal(g.phase(), "offline");
  g.controller.setParticipant("chart", false); g.reads([fetched]); g.settle(); assert.equal(g.phase(), "ready");
});

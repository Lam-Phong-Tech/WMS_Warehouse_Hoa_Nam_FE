import { it as test } from "vitest";
import assert from "node:assert/strict";
import { LoadingController, type LoadingRead } from "./loading-controller";
import { createChartRenderCycle } from "./chart-render-cycle";

function setup() {
  let reads: LoadingRead[] = [];
  let sequence = 0;
  const frames = new Map<number, () => void>();
  const controller = new LoadingController({
    reads: () => reads,
    covered: () => false,
    nextFrame: (callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return () => { frames.delete(id); };
    },
  });
  controller.activate();
  return {
    controller,
    phase: () => controller.getSnapshot().phase,
    reads: (next: LoadingRead[]) => { reads = next; controller.refresh(); },
    settle: () => {
      for (let i = 0; i < 4; i += 1) {
        const callbacks = [...frames.values()]; frames.clear();
        callbacks.forEach((callback) => callback());
      }
    },
  };
}

test("chart module and SVG must finish before an API-ready page is revealed", () => {
  const h = setup();
  const draw = createChartRenderCycle(h.controller, "chart", { current: null });
  draw.activate();
  h.reads([{ active: true, hasData: true, fetchStatus: "idle" }]);
  h.settle(); assert.equal(h.phase(), "loading");
  draw.complete(); h.settle(); assert.equal(h.phase(), "ready");
});
test("multiple chart cards reveal together, not when the first SVG finishes", () => {
  const h = setup();
  const first = createChartRenderCycle(h.controller, "first", { current: null });
  const second = createChartRenderCycle(h.controller, "second", { current: null });
  first.activate(); second.activate(); first.complete();
  h.settle(); assert.equal(h.phase(), "loading");
  second.complete(); h.settle(); assert.equal(h.phase(), "ready");
});
test("an older filter's chart callback cannot release the latest draw", () => {
  const h = setup(); const owner = { current: null as object | null };
  const old = createChartRenderCycle(h.controller, "chart", owner);
  const next = createChartRenderCycle(h.controller, "chart", owner);
  old.activate(); old.dispose(); next.activate(); old.complete();
  h.settle(); assert.equal(h.phase(), "loading");
  next.complete(); h.settle(); assert.equal(h.phase(), "ready");
});
test("late cleanup from an older draw does not cancel its successor", () => {
  const h = setup(); const owner = { current: null as object | null };
  const old = createChartRenderCycle(h.controller, "chart", owner);
  const next = createChartRenderCycle(h.controller, "chart", owner);
  old.activate(); next.activate(); old.dispose();
  h.settle(); assert.equal(h.phase(), "loading");
  next.complete(); h.settle(); assert.equal(h.phase(), "ready");
});
test("unmount or caught chunk failure releases the ticket without claiming chart success", () => {
  const h = setup(); const draw = createChartRenderCycle(h.controller, "chart", { current: null });
  draw.activate(); draw.dispose(); h.settle(); assert.equal(h.phase(), "ready");
  draw.complete(); h.settle(); assert.equal(h.phase(), "ready");
});
test("StrictMode-style effect replay re-arms the lifecycle ticket", () => {
  const h = setup(); const draw = createChartRenderCycle(h.controller, "chart", { current: null });
  draw.activate(); draw.dispose(); draw.activate();
  h.settle(); assert.equal(h.phase(), "loading");
  draw.complete(); h.settle(); assert.equal(h.phase(), "ready");
});
test("foreground cached-data refresh also waits for its new chart revision", () => {
  const h = setup(); h.settle(); assert.equal(h.phase(), "ready");
  h.controller.beginBatch();
  h.reads([{ active: true, hasData: true, fetchStatus: "fetching" }]);
  const draw = createChartRenderCycle(h.controller, "chart", { current: null });
  draw.activate(); h.reads([{ active: true, hasData: true, fetchStatus: "idle" }]);
  h.settle(); assert.equal(h.phase(), "loading");
  draw.complete(); draw.complete(); h.settle(); assert.equal(h.phase(), "ready");
});
test("standalone chart has a safe no-controller lifecycle", () => {
  const owner = { current: null as object | null };
  const draw = createChartRenderCycle(null, "standalone", owner);
  draw.activate(); draw.complete(); draw.dispose(); assert.equal(owner.current, null);
});

test("an already visible chart can redraw without remasking a ready page", () => {
  const h = setup(); h.settle();
  const draw = createChartRenderCycle(h.controller, "chart", { current: null });
  draw.activate(false); assert.equal(h.phase(), "ready");
  draw.complete(); draw.dispose(); h.settle(); assert.equal(h.phase(), "ready");
});

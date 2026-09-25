import assert from "node:assert/strict";
import { it as test } from "vitest";
import { LoadingController, type LoadingPhase, type LoadingRead } from "./loading-controller";
import { shouldBlockLoadingSurface } from "./loading-presentation";

for (const phase of ["loading", "offline", "ready"] as const) {
  for (const initial of [true, false]) {
    for (const enabled of [true, false]) {
      test(`presentation: phase=${phase}, initial=${initial}, enabled=${enabled}`, () => {
        assert.equal(
          shouldBlockLoadingSurface({ phase, initial }, enabled),
          enabled && initial && phase !== "ready",
        );
      });
    }
  }
}

function setup() {
  let reads: LoadingRead[] = [];
  const frames = new Set<() => void>();
  const controller = new LoadingController({
    reads: () => reads,
    covered: () => false,
    nextFrame: (callback) => {
      frames.add(callback);
      return () => { frames.delete(callback); };
    },
  });
  controller.activate();
  return {
    controller,
    blocked: () => shouldBlockLoadingSurface(controller.getSnapshot(), true),
    read: (next: LoadingRead[]) => { reads = next; controller.refresh(); },
    settle: () => {
      for (let i = 0; i < 4; i += 1) {
        const callbacks = [...frames]; frames.clear();
        callbacks.forEach((callback) => callback());
      }
    },
  };
}

test("first API results and chart draws still reveal together", () => {
  const h = setup();
  h.read([{ active: true, hasData: false, fetchStatus: "fetching" }]);
  h.controller.setParticipant("chart", true);
  h.read([{ active: true, hasData: true, fetchStatus: "idle" }]);
  h.settle(); assert.equal(h.blocked(), true);
  h.controller.setParticipant("chart", false);
  h.settle(); assert.equal(h.blocked(), false);
});

for (const fetchStatus of ["fetching", "paused"] as const) {
  test(`uncached filter (${fetchStatus}) never remasks a revealed screen`, () => {
    const h = setup(); h.settle(); assert.equal(h.blocked(), false);
    h.controller.beginBatch();
    h.read([{ active: true, hasData: false, fetchStatus }]);
    h.settle();
    const phase: LoadingPhase = fetchStatus === "paused" ? "offline" : "loading";
    assert.equal(h.controller.getSnapshot().phase, phase);
    assert.equal(h.blocked(), false);
  });
}

test("refresh plus delayed chart work stays non-blocking until all work settles", () => {
  const h = setup(); h.settle();
  h.controller.beginBatch();
  h.read([{ active: true, hasData: true, fetchStatus: "fetching" }]);
  h.controller.setParticipant("chart", true);
  assert.equal(h.blocked(), false);
  h.read([{ active: true, hasData: true, fetchStatus: "idle" }]);
  h.settle(); assert.equal(h.blocked(), false);
  assert.equal(h.controller.getSnapshot().phase, "loading");
  h.controller.setParticipant("chart", false);
  h.settle(); assert.equal(h.controller.getSnapshot().phase, "ready");
});

test("a late participant or returning keep-alive page cannot re-lock the filters", () => {
  const h = setup(); h.settle();
  h.controller.deactivate(); h.controller.setParticipant("detail", true);
  h.controller.activate(); h.settle();
  assert.equal(h.blocked(), false);
  h.controller.setParticipant("detail", false); h.settle();
  assert.equal(h.blocked(), false);
});

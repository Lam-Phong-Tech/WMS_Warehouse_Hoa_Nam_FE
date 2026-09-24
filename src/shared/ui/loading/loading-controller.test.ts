import { it as test } from "vitest";
import assert from "node:assert/strict";
import { LoadingController, type LoadingRead } from "./loading-controller";

function setup(reads: LoadingRead[] = []) {
  let current = reads;
  let covered = false;
  let sequence = 0;
  const frames = new Map<number, () => void>();
  const controller = new LoadingController({
    reads: () => current,
    covered: () => covered,
    nextFrame: (callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return () => { frames.delete(id); };
    },
  });
  const frame = () => {
    const tasks = [...frames.values()];
    frames.clear();
    tasks.forEach((fn) => fn());
  };
  controller.activate();
  return {
    controller,
    phase: () => controller.getSnapshot().phase,
    reads: (next: LoadingRead[]) => { current = next; controller.refresh(); },
    cover: (value: boolean) => { covered = value; controller.refresh(); },
    frame,
    settle: () => { for (let i = 0; i < 4; i += 1) frame(); },
    count: () => frames.size,
  };
}
const cold: LoadingRead = { active: true, hasData: false, fetchStatus: "fetching" };
const ready: LoadingRead = { active: true, hasData: true, fetchStatus: "idle" };

test("initial: does not reveal the first of three independent results", () => {
  const h = setup([cold, cold, cold]);
  h.reads([ready, cold, cold]); h.settle(); assert.equal(h.phase(), "loading");
  h.reads([ready, ready, cold]); h.settle(); assert.equal(h.phase(), "loading");
  h.reads([ready, ready, ready]); h.frame(); assert.equal(h.phase(), "loading");
  h.frame(); assert.equal(h.phase(), "ready");
});
test("dependent queries can join between notifications and the next commit", () => {
  const h = setup([cold]); h.reads([ready]); h.frame();
  h.reads([ready, cold]); h.settle(); assert.equal(h.phase(), "loading");
  h.reads([ready, ready]); h.settle(); assert.equal(h.phase(), "ready");
});
test("disabled and unobserved prefetch queries do not block", () => {
  const h = setup([{ ...cold, active: false }, { ...cold, active: false, fetchStatus: "idle" }]);
  h.settle(); assert.equal(h.phase(), "ready");
});
test("background polling with data does not remask a ready page", () => {
  const h = setup([ready]); h.settle(); h.reads([{ ...ready, fetchStatus: "fetching" }]);
  assert.equal(h.phase(), "ready"); assert.equal(h.count(), 0);
});
test("initial stale-cache refetch still waits for all reads", () => {
  const h = setup([{ ...ready, fetchStatus: "fetching" }, ready]);
  h.settle(); assert.equal(h.phase(), "loading");
  h.reads([ready, ready]); h.settle(); assert.equal(h.phase(), "ready");
});
test("explicit refresh waits for every cached-data request, not the first", () => {
  const h = setup([ready, ready]); h.settle(); h.controller.beginBatch();
  h.reads([{ ...ready, fetchStatus: "fetching" }, { ...ready, fetchStatus: "fetching" }]);
  h.reads([ready, { ...ready, fetchStatus: "fetching" }]);
  h.settle(); assert.equal(h.phase(), "loading");
  h.reads([ready, ready]); h.settle(); assert.equal(h.phase(), "ready");
});
test("read-action validation without a request does not show fake progress", () => {
  const h = setup([ready]); h.settle(); h.controller.beginBatch();
  assert.equal(h.phase(), "ready"); h.settle(); assert.equal(h.phase(), "ready");
});
test("new filter query masks the entire screen until data is ready", () => {
  const h = setup([ready]); h.settle(); h.reads([cold]); assert.equal(h.phase(), "loading");
  h.reads([ready]); h.settle(); assert.equal(h.phase(), "ready");
});
test("a failed read settles, but does not release other outstanding reads", () => {
  const failed: LoadingRead = { active: true, hasData: false, fetchStatus: "idle" };
  const h = setup([cold, cold]); h.reads([failed, cold]); h.settle(); assert.equal(h.phase(), "loading");
  h.reads([failed, ready]); h.settle(); assert.equal(h.phase(), "ready");
});
test("paused offline query is not an endless spinner or fake success", () => {
  const h = setup([{ ...cold, fetchStatus: "paused" }]); assert.equal(h.phase(), "offline");
  h.settle(); assert.equal(h.phase(), "offline"); h.reads([cold]); assert.equal(h.phase(), "loading");
  h.reads([ready]); h.settle(); assert.equal(h.phase(), "ready");
});
test("Suspense/module participants block until actually removed", () => {
  const h = setup([]); h.controller.setParticipant("module", true); h.settle(); assert.equal(h.phase(), "loading");
  h.controller.setParticipant("module", false); h.settle(); assert.equal(h.phase(), "ready");
});
test("modal reads do not mask an already visible page", () => {
  const h = setup([ready]); h.settle(); h.cover(true); h.reads([ready, cold]);
  assert.equal(h.phase(), "ready"); h.reads([ready, ready]); h.cover(false); h.settle(); assert.equal(h.phase(), "ready");
});
test("background opt-out is explicit and never turns a disabled query into active", () => {
  const h = setup([{ ...cold, background: true }]); h.settle(); assert.equal(h.phase(), "ready");
});
test("keep-alive deactivation cancels pending reveal callbacks", () => {
  const h = setup([]); assert.equal(h.count(), 1); h.controller.deactivate(); assert.equal(h.count(), 0);
  h.settle(); assert.equal(h.phase(), "loading"); h.controller.activate(); h.settle(); assert.equal(h.phase(), "ready");
});
test("snapshot identity is stable if no visible phase changed", () => {
  const h = setup([cold]); const before = h.controller.getSnapshot(); h.controller.refresh();
  assert.equal(h.controller.getSnapshot(), before);
});
test("a transient empty query set cannot reveal before a dependent loader mounts", () => {
  const h = setup([cold]); h.reads([]); h.frame(); h.controller.setParticipant("next", true);
  h.settle(); assert.equal(h.phase(), "loading"); h.controller.setParticipant("next", false);
  h.settle(); assert.equal(h.phase(), "ready");
});
test("offline with a complete cached snapshot is not treated as missing data", () => {
  const h = setup([{ ...ready, fetchStatus: "paused" }]);
  h.settle(); assert.equal(h.phase(), "ready");
});

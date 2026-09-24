import { it } from "vitest";
import assert from "node:assert/strict";
import { LoadingController, type LoadingRead } from "./loading-controller";
import { createForegroundReadTask } from "./foreground-read";
import { createForegroundReadIntent } from "./foreground-interaction";

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
  const settle = () => {
    for (let i = 0; i < 4; i += 1) {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback());
    }
  };
  controller.activate();
  settle();
  return {
    controller,
    settle,
    phase: () => controller.getSnapshot().phase,
    reads: (next: LoadingRead[]) => { reads = next; controller.refresh(); },
  };
}
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it("waits for the real read promise without a cosmetic timer", async () => {
  const h = setup();
  const task = createForegroundReadTask(h.controller, "report");
  const read = deferred();
  const result = task.run(() => read.promise);
  h.settle(); assert.equal(h.phase(), "loading");
  read.resolve("done"); assert.equal(await result, "done");
  h.settle(); assert.equal(h.phase(), "ready");
});
it("all parallel reads finish before the common gate reveals", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "report");
  const first = deferred(), second = deferred();
  const a = task.run(() => first.promise), b = task.run(() => second.promise);
  first.resolve("first"); await a; h.settle(); assert.equal(h.phase(), "loading");
  second.resolve("second"); await b; h.settle(); assert.equal(h.phase(), "ready");
});
it("rejecting a read releases its ticket and preserves the failure", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "report");
  const failure = new Error("read failed");
  await assert.rejects(task.run(() => Promise.reject(failure)), (error) => error === failure);
  h.settle(); assert.equal(h.phase(), "ready");
});
it("a synchronous exception does not leave an endless loader", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "report");
  await assert.rejects(task.run(() => { throw new Error("sync"); }), /sync/);
  h.settle(); assert.equal(h.phase(), "ready");
});
it("closing a scope releases presentation without cancelling the request", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "dialog");
  const read = deferred(); const result = task.run(() => read.promise);
  task.deactivate(); h.settle(); assert.equal(h.phase(), "ready");
  read.resolve("server-result"); assert.equal(await result, "server-result");
  task.deactivate(); h.settle(); assert.equal(h.phase(), "ready");
});
it("a disposed read cannot release a newer request from the same hook", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "dialog");
  const first = deferred(), second = deferred();
  const a = task.run(() => first.promise); task.deactivate();
  task.activate();
  const b = task.run(() => second.promise);
  first.resolve("old"); await a; h.settle(); assert.equal(h.phase(), "loading");
  second.resolve("new"); await b; h.settle(); assert.equal(h.phase(), "ready");
});
it("finishing a read does not release an unfinished chart", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "report");
  h.controller.setParticipant("chart", true);
  await task.run(async () => "data"); h.settle(); assert.equal(h.phase(), "loading");
  h.controller.setParticipant("chart", false); h.settle(); assert.equal(h.phase(), "ready");
});
it("foreground reads also wait for slower cached query refetches", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "report");
  const result = task.run(() => {
    h.reads([{ active: true, hasData: true, fetchStatus: "fetching" }]);
    return "triggered";
  });
  await result; h.settle(); assert.equal(h.phase(), "loading");
  h.reads([{ active: true, hasData: true, fetchStatus: "idle" }]);
  h.settle(); assert.equal(h.phase(), "ready");
});
it("standalone use preserves return values without a loading provider", async () => {
  const task = createForegroundReadTask(null, "standalone");
  assert.equal(await task.run(() => 7), 7);
  task.deactivate();
});
it("read intent expires before an unrelated background polling tick", () => {
  const callbacks: (() => void)[] = [];
  const intent = createForegroundReadIntent((callback) => { callbacks.push(callback); });
  assert.equal(intent.isArmed(), false);
  intent.arm(); assert.equal(intent.isArmed(), true);
  callbacks.shift()!(); assert.equal(intent.isArmed(), false);
});
it("older interaction cleanup cannot clear a newer interaction", () => {
  const callbacks: (() => void)[] = [];
  const intent = createForegroundReadIntent((callback) => { callbacks.push(callback); });
  intent.arm(); intent.arm(); callbacks.shift()!();
  assert.equal(intent.isArmed(), true); callbacks.shift()!();
  assert.equal(intent.isArmed(), false);
});
it("navigation clears the previous scope's foreground intent", () => {
  const callbacks: (() =>void)[] = [];
  const intent = createForegroundReadIntent((callback) => { callbacks.push(callback); });
  intent.arm(); intent.clear(); assert.equal(intent.isArmed(), false);
  intent.arm(); callbacks.shift()!(); assert.equal(intent.isArmed(), true);
  callbacks.shift()!(); assert.equal(intent.isArmed(), false);
});

it("keep-alive resume rejoins a read that is still running", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "kept");
  const read = deferred(); const result = task.run(() => read.promise);
  task.deactivate(); h.settle(); assert.equal(h.phase(), "ready");
  task.activate(); h.settle(); assert.equal(h.phase(), "loading");
  read.resolve("finished"); await result; h.settle(); assert.equal(h.phase(), "ready");
});
it("a read completed while hidden cannot leave a spinner on resume", async () => {
  const h = setup(); const task = createForegroundReadTask(h.controller, "kept");
  const read = deferred(); const result = task.run(() => read.promise);
  task.deactivate(); read.resolve("finished"); await result;
  task.activate(); h.settle(); assert.equal(h.phase(), "ready");
});

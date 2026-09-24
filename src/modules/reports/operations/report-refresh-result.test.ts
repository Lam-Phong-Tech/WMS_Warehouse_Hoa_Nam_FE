import { it } from "vitest";
import assert from "node:assert/strict";
import { reportRefreshResult } from "./report-refresh-result";

const success = { status: "success", isError: false, error: null };
it("accepts a successful query result", () => {
  assert.deepEqual(reportRefreshResult(success), { kind: "success" });
});
it("detects resolved query errors rather than treating them as success", () => {
  const error = new Error("read unavailable");
  assert.deepEqual(reportRefreshResult({ status: "error", isError: true, error }), { kind: "error", error });
});
it("recognizes a complete parallel query group", () => {
  assert.deepEqual(reportRefreshResult([success, [success, success]]), { kind: "success" });
});
it("one failed member prevents success for the whole refresh", () => {
  const error = new Error("second source failed");
  assert.deepEqual(reportRefreshResult([success, { status: "error", isError: true, error }]), { kind: "error", error });
});
it("reads allSettled query results", () => {
  assert.deepEqual(reportRefreshResult([{ status: "fulfilled", value: success }]), { kind: "success" });
});
it("does not swallow a rejected allSettled member", () => {
  const error = new Error("rejected");
  assert.deepEqual(reportRefreshResult([{ status: "fulfilled", value: success }, { status: "rejected", reason: error }]), { kind: "error", error });
});
it("ordinary service payloads still use the caller's error contract", () => {
  for (const value of [undefined, null, 0, "done", {}, { status: "success" }]) {
    assert.deepEqual(reportRefreshResult(value), { kind: "unknown" });
  }
});
it("an empty or incomplete result group is not manufactured success", () => {
  assert.deepEqual(reportRefreshResult([]), { kind: "unknown" });
  assert.deepEqual(reportRefreshResult([success, undefined]), { kind: "unknown" });
});
it("a failed query with no error detail still remains failed", () => {
  const value = { status: "error", isError: true, error: null };
  assert.deepEqual(reportRefreshResult(value), { kind: "error", error: value });
});

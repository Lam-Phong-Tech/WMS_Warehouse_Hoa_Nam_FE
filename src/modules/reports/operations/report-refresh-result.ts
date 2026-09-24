export type ReportRefreshResult =
  | { kind: "success" }
  | { kind: "error"; error: unknown }
  | { kind: "unknown" };

/**
 * React Query refetch resolves even on failure. Read the returned outcome, not
 * the error captured by the render that started the request. Plain service
 * values remain unknown so callers can keep their existing readError contract.
 */
export function reportRefreshResult(value: unknown): ReportRefreshResult {
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "unknown" };
    let complete = true;
    for (const item of value) {
      const outcome = reportRefreshResult(item);
      if (outcome.kind === "error") return outcome;
      if (outcome.kind === "unknown") complete = false;
    }
    return { kind: complete ? "success" : "unknown" };
  }
  if (value === null || typeof value !== "object") return { kind: "unknown" };
  const result = value as Record<string, unknown>;
  if (result.status === "fulfilled" && "value" in result) {
    return reportRefreshResult(result.value);
  }
  if (result.status === "rejected" && "reason" in result) {
    return { kind: "error", error: result.reason ?? value };
  }
  if (result.status === "error" && result.isError === true) {
    return { kind: "error", error: result.error ?? value };
  }
  if (result.status === "success" && result.isError === false) {
    return { kind: "success" };
  }
  return { kind: "unknown" };
}

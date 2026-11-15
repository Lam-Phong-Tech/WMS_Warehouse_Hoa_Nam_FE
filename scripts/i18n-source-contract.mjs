/** Pure source-review gate; regex translation coverage cannot approve new prose. */
export function checkSourceReview(records, runtimeExpressions, manifest) {
  const reviewed = new Set(
    manifest.messages.flatMap((message) => [
      message.source,
      ...message.rawSources,
    ]),
  );
  const unreviewed = records.filter((record) =>
    [record.normalized, record.source]
      .filter(Boolean)
      .some((message) => !reviewed.has(message)),
  );
  // Line-only changes do not change an expression's classification.
  const signature = (expression) =>
    JSON.stringify([expression.path, expression.sink, expression.expression]);
  const reviewedRuntime = new Set(manifest.unresolved.map(signature));
  const unreviewedRuntime = runtimeExpressions.filter(
    (expression) => !reviewedRuntime.has(signature(expression)),
  );
  return { unreviewed, unreviewedRuntime };
}

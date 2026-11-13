/** Only presentation consumes this budget; persisted history and badge never do. */
export function createNotificationToastBudget({
  now = Date.now,
  maxIndividual = 3,
  windowMs = 10_000,
}: { now?: () => number; maxIndividual?: number; windowMs?: number } = {}) {
  let admitted: number[] = [];
  return {
    take(count: number): number {
      if (!Number.isFinite(count) || count <= 0) return 0;
      const time = now();
      admitted = admitted.filter((at) => at > time - windowMs);
      const allowed = Math.min(
        Math.floor(count),
        Math.max(0, maxIndividual - admitted.length),
      );
      for (let i = 0; i < allowed; i++) admitted.push(time);
      return allowed;
    },
    reset(): void {
      admitted = [];
    },
  };
}

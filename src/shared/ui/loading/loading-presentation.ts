import type { LoadingSnapshot } from "./loading-controller";

/**
 * Loading work is not permission to hide an already usable surface. Filters,
 * search, pagination, refreshes and late chart draws use their local read states.
 * A fresh page/dialog still waits for its first coordinated result.
 */
export function shouldBlockLoadingSurface(
  snapshot: LoadingSnapshot,
  enabled: boolean,
): boolean {
  return enabled && snapshot.initial && snapshot.phase !== "ready";
}

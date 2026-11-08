import type { Query, QueryClient } from "@tanstack/react-query";
import { isOperationalReadQueryKey } from "./operational-queries";

export interface OperationalRefreshOptions {
  queryClient: QueryClient;
  isCurrent: () => boolean;
  canFetch: () => boolean;
  debounceMs?: number;
}

export function createOperationalRefreshController({
  queryClient,
  isCurrent,
  canFetch,
  debounceMs = 200,
}: OperationalRefreshOptions) {
  const cache = queryClient.getQueryCache();
  const queued = new Set<Query>();
  const running = new Set<Query>();
  const trailing = new Set<Query>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const owns = () => !disposed && isCurrent();
  const exists = (query: Query) => cache.get(query.queryHash) === query;

  function arm() {
    if (!owns() || !canFetch() || timer !== undefined || queued.size === 0)
      return;
    // Fixed window: a sustained stream cannot postpone refresh indefinitely.
    timer = setTimeout(flush, debounceMs);
  }

  async function refresh(query: Query) {
    running.add(query);
    try {
      // An older initial fetch can swallow invalidateQueries and clear stale.
      // Wait for it, then explicitly obtain a post-signal response. Each query
      // has its own flight so a slow drawer cannot block the current table.
      if (query.state.fetchStatus === "fetching") {
        await query.promise?.catch(() => undefined);
      }
      if (!owns() || !exists(query)) return;
      if (!canFetch()) {
        queued.add(query);
        return;
      }
      if (!query.isActive()) {
        query.invalidate();
        return;
      }
      await queryClient.refetchQueries(
        { queryKey: query.queryKey, exact: true, type: "active" },
        { cancelRefetch: false },
      );
    } finally {
      running.delete(query);
      if (trailing.delete(query) && owns() && exists(query)) queued.add(query);
      arm();
    }
  }

  function flush() {
    timer = undefined;
    if (!owns() || !canFetch()) return;
    const batch = [...queued];
    queued.clear();
    for (const query of batch) {
      if (!exists(query)) continue;
      if (running.has(query)) trailing.add(query);
      else void refresh(query);
    }
  }

  return {
    schedule() {
      if (!owns()) return;
      for (const query of cache.getAll()) {
        if (!isOperationalReadQueryKey(query.queryKey)) continue;
        query.invalidate();
        queued.add(query);
      }
      arm();
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      queued.clear();
      trailing.clear();
    },
  };
}

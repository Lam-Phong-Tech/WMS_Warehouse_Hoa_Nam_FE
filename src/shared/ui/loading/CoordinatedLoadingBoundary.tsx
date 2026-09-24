import {
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { QueryClientContext, type QueryClient } from "@tanstack/react-query";
import { usePageVisible } from "@/shared/ui/page-visibility";
import { useT } from "@/shared/i18n/useT";
import { LoadingContext, LoadingDepthContext } from "./loading-context";
import { LoadingController } from "./loading-controller";
import { LoadingOverlayStack } from "./loading-stack";
import { UnifiedLoading } from "./UnifiedLoading";
import "./coordinated-loading.css";

const stacks = new WeakMap<QueryClient, LoadingOverlayStack>();

function stackFor(client: QueryClient | undefined): LoadingOverlayStack {
  if (!client) return new LoadingOverlayStack();
  let stack = stacks.get(client);
  if (!stack) {
    stack = new LoadingOverlayStack();
    stacks.set(client, stack);
  }
  return stack;
}

function nextRenderFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) callback();
  });
  return () => { cancelled = true; };
}

export interface CoordinatedLoadingBoundaryProps {
  children: ReactNode;
  mode?: "page" | "dialog" | "drawer";
  active?: boolean;
}

/**
 * Keep children mounted and measurable until the visible read group settles.
 * Errors are settled outcomes; existing error/empty/403 renderers remain intact.
 * Disabled queries, unobserved prefetches and cached background refreshes do not
 * block. This barrier never changes HTTP, mutations or cached business data.
 */
export function CoordinatedLoadingBoundary({
  children,
  mode = "page",
  active = true,
}: CoordinatedLoadingBoundaryProps) {
  const client = useContext(QueryClientContext);
  const visible = usePageVisible();
  const id = useId();
  const parentDepth = useContext(LoadingDepthContext);
  const depth = parentDepth + (mode === "page" ? 0 : 1);
  const t = useT();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const savedFocus = useRef<HTMLElement | null>(null);
  const stack = useMemo(() => stackFor(client), [client]);
  const topOverlay = useSyncExternalStore(
    stack.subscribe,
    stack.getSnapshot,
    stack.getSnapshot,
  );
  // A keepMounted dialog opening again gets a fresh initial barrier. Activity
  // visibility alone does not recreate it, so cached page navigation stays fast.
  const controller = useMemo(() => new LoadingController({
    reads: () => active
      ? client?.getQueryCache().getAll().map((query) => ({
          active: query.isActive(),
          hasData: query.state.data !== undefined,
          fetchStatus: query.state.fetchStatus,
          background: query.meta?.loading === "background",
        })) ?? []
      : [],
    covered: () => {
      const top = stack.getSnapshot();
      return top !== undefined && top !== id;
    },
    nextFrame: nextRenderFrame,
  }), [active, client, id, stack]);
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const enabled = active && visible;

  useLayoutEffect(() => {
    if (!enabled) return;
    const removeOverlay = mode === "page" ? undefined : stack.add(id, depth);
    const cache = client?.getQueryCache();
    const activeReads = new Set(cache?.getAll().filter((query) => query.isActive()).map((query) => query.queryHash));
    const unsubscribeQueries = cache?.subscribe((event) => {
      // A newly observed/enabled key is foreground work (tab/filter/page),
      // even when cached. Updates of existing active reads stay background.
      // Do not arm the page behind a portal dialog or an inactive query.
      const top = stack.getSnapshot();
      const wasActive = activeReads.has(event.query.queryHash);
      const isActive = event.query.isActive();
      if (isActive) activeReads.add(event.query.queryHash);
      else activeReads.delete(event.query.queryHash);
      if (
        isActive && (!wasActive || event.type === "observerAdded") &&
        event.query.meta?.loading !== "background" &&
        (top === undefined || top === id)
      ) controller.beginBatch();
      else controller.refresh();
    });
    const unsubscribeOverlays = stack.subscribe(controller.refresh);
    controller.activate();
    return () => {
      controller.deactivate();
      unsubscribeQueries?.();
      unsubscribeOverlays();
      removeOverlay?.();
    };
  }, [client, controller, depth, enabled, id, mode, stack]);

  const blocked = enabled && snapshot.phase !== "ready";
  const covered = topOverlay !== undefined && topOverlay !== id;
  useLayoutEffect(() => {
    if (blocked) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && surfaceRef.current?.contains(focused)) {
        savedFocus.current = focused;
      }
      return;
    }
    const focused = savedFocus.current;
    savedFocus.current = null;
    if (focused?.isConnected && document.activeElement === document.body && !covered) {
      focused.focus({ preventScroll: true });
    }
  }, [blocked, covered]);

  return (
    <LoadingDepthContext.Provider value={depth}>
      <LoadingContext.Provider value={controller}>
        <div
          ref={surfaceRef}
          onClickCapture={(event) => {
            // Portal clicks belong to the dialog, not the page behind it.
            const target = event.target;
            if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
            const action = target.closest("[data-action-kind], [data-loading-batch]");
            const kind = action?.getAttribute("data-action-kind");
            if (
              action?.hasAttribute("data-loading-batch") ||
              kind === "refresh" || kind === "search" ||
              kind === "filter" || kind === "reset" || kind === "retry"
            ) controller.beginBatch();
          }}
          className={`hn-loading-boundary hn-loading-boundary--${mode}`}
          data-loading-phase={enabled ? snapshot.phase : "inactive"}
          data-loading-initial={snapshot.initial ? "true" : "false"}
          aria-busy={blocked && snapshot.phase === "loading"}
        >
          <div
            className="hn-loading-boundary__content"
            aria-hidden={blocked || undefined}
            inert={blocked || undefined}
            style={blocked ? { visibility: "hidden" } : undefined}
          >
            {children}
          </div>
          {blocked ? (
            <div
              className="hn-loading-boundary__cover"
              style={covered ? { visibility: "hidden" } : undefined}
            >
              {snapshot.phase === "offline" ? (
                <div className="hn-unified-loading" data-ui-state="offline" role="status" aria-live="polite">
                  <strong>{t("shared.pwa.offlineTitle")}</strong>
                  <span>{t("shared.pwa.offlineBody")}</span>
                  <button
                    type="button"
                    className="hn-loading-boundary__retry"
                    onClick={() => {
                      controller.beginBatch();
                      void client?.refetchQueries({ type: "active" }, { throwOnError: false });
                    }}
                  >
                    {t("common.retry")}
                  </button>
                </div>
              ) : <UnifiedLoading />}
            </div>
          ) : null}
        </div>
      </LoadingContext.Provider>
    </LoadingDepthContext.Provider>
  );
}

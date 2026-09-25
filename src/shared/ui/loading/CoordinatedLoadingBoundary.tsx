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
import { shouldBlockLoadingSurface } from "./loading-presentation";
import { LoadingOverlayStack } from "./loading-stack";
import { createForegroundReadIntent } from "./foreground-interaction";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ContentLoadingSkeleton } from "./ContentLoadingSkeleton";
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
  /** Eager layout placeholders; never register this fallback as pending work. */
  fallback?: ReactNode;
}

/**
 * Keep children mounted and measurable until the visible read group settles.
 * Errors are settled outcomes; existing error/empty/403 renderers remain intact.
 * Disabled queries, unobserved prefetches and cached background refreshes do not
 * block. After the initial reveal, all reads keep the surface interactive;
 * tables/charts own their local pending/error states. This boundary never
 * changes HTTP, mutations or cached business data.
 */
export function CoordinatedLoadingBoundary({
  children,
  mode = "page",
  active = true,
  fallback,
}: CoordinatedLoadingBoundaryProps) {
  const client = useContext(QueryClientContext);
  const visible = usePageVisible();
  const id = useId();
  const parentDepth = useContext(LoadingDepthContext);
  const depth = parentDepth + (mode === "page" ? 0 : 1);
  const t = useT();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const savedFocus = useRef<HTMLElement | null>(null);
  const stack = useMemo(() => stackFor(client), [client]);
  const readIntent = useMemo(() => createForegroundReadIntent(), []);
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
      // Include plain-button refetches of an existing cached key. Only reads
      // started by this surface's current interaction are foreground; mutation
      // events and later polling/refetch ticks never consume the gesture.
      const top = stack.getSnapshot();
      const wasActive = activeReads.has(event.query.queryHash);
      const isActive = event.query.isActive();
      if (isActive) activeReads.add(event.query.queryHash);
      else activeReads.delete(event.query.queryHash);
      const interactiveRead =
        readIntent.isArmed() &&
        event.type === "updated" &&
        event.action.type === "fetch";
      if (
        isActive && (!wasActive || event.type === "observerAdded" || interactiveRead) &&
        event.query.meta?.loading !== "background" &&
        (top === undefined || top === id)
      ) controller.beginBatch();
      else controller.refresh();
    });
    const unsubscribeOverlays = stack.subscribe(controller.refresh);
    controller.activate();
    return () => {
      readIntent.clear();
      controller.deactivate();
      unsubscribeQueries?.();
      unsubscribeOverlays();
      removeOverlay?.();
    };
  }, [client, controller, depth, enabled, id, mode, readIntent, stack]);

  // A new filter/key/participant may be pending without resetting the page.
  // Use this same decision for the cover, CSS, focus and accessibility state.
  const blocked = shouldBlockLoadingSurface(snapshot, enabled);
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

  const ownsInteraction = (target: EventTarget | null) =>
    enabled &&
    target instanceof Element &&
    target.closest(".hn-loading-boundary") === surfaceRef.current;

  return (
    <LoadingDepthContext.Provider value={depth}>
      <LoadingContext.Provider value={controller}>
        <div
          ref={surfaceRef}
          onClickCapture={(event) => {
            // Portal/nested-scope clicks belong only to their nearest boundary.
            const target = event.target;
            if (!ownsInteraction(target) || !(target instanceof Element)) return;
            readIntent.arm();
            const action = target.closest("[data-action-kind], [data-loading-batch]");
            const kind = action?.getAttribute("data-action-kind");
            if (
              action?.hasAttribute("data-loading-batch") ||
              kind === "refresh" || kind === "search" ||
              kind === "filter" || kind === "reset" || kind === "retry"
            ) controller.beginBatch();
          }}
          onSubmitCapture={(event) => {
            if (ownsInteraction(event.target)) readIntent.arm();
          }}
          onKeyDownCapture={(event) => {
            if (event.key === "Enter" && ownsInteraction(event.target)) readIntent.arm();
          }}
          className={`hn-loading-boundary hn-loading-boundary--${mode}`}
          data-loading-phase={enabled ? snapshot.phase : "inactive"}
          data-loading-initial={snapshot.initial ? "true" : "false"}
          data-loading-blocked={blocked ? "true" : "false"}
          aria-busy={blocked && snapshot.phase === "loading"}
        >
          <div
            ref={contentRef}
            className="hn-loading-boundary__content"
            aria-hidden={blocked || undefined}
            inert={blocked || undefined}
            style={blocked ? { visibility: "hidden" } : undefined}
          >
            {children}
          </div>
          {blocked ? (
            <div
              className={`hn-loading-boundary__cover${snapshot.phase === "loading" ? " hn-loading-boundary__cover--skeleton" : ""}`}
              aria-hidden={covered || undefined}
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
              ) : (
                <ContentLoadingSkeleton
                  contentRef={contentRef}
                  label={t("shared.states.loadingData")}
                  fallback={fallback ?? <LoadingSkeleton layout={mode === "page" ? "list" : "detail"} />}
                />
              )}
            </div>
          ) : null}
        </div>
      </LoadingContext.Provider>
    </LoadingDepthContext.Provider>
  );
}

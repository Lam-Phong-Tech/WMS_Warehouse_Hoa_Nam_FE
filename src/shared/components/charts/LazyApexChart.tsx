import {
  Component,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import type { ApexOptions } from "apexcharts";
import { LoadingContext } from "@/shared/ui/loading/loading-context";
import { createChartRenderCycle } from "@/shared/ui/loading/chart-render-cycle";
import { UnifiedLoading } from "@/shared/ui/loading/UnifiedLoading";
import { UiStateSurface } from "@/shared/ui/components/UiStateSurface";
import { useT } from "@/shared/i18n/useT";

const loadChart = () => import("react-apexcharts");
const InitialApexChart = lazy(loadChart);
type ChartComponent = Awaited<ReturnType<typeof loadChart>>["default"];
type ApexChartProps = ComponentProps<ChartComponent>;
type ChartEvents = NonNullable<NonNullable<ApexOptions["chart"]>["events"]>;
type LifecycleEvent = NonNullable<ChartEvents["mounted"]>;

/** A failed chunk must settle the screen, not retain an invisible participant. */
class ChartErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * One ticket covers the module AND the actual SVG mount/update. The generated
 * lifecycle callbacks also make an equal-data refresh an observable Apex update,
 * so it cannot leave a ticket waiting for an event that will never be emitted.
 * Do not remount on data changes: preserve the chart's legend/zoom interactions.
 */
function CoordinatedChart({
  Chart,
  ...props
}: ApexChartProps & { Chart: LazyExoticComponent<ChartComponent> }) {
  const controller = useContext(LoadingContext);
  const id = useId();
  const currentCycle = useRef<object | null>(null);
  const hasRendered = useRef(false);
  const cycle = useMemo(() => {
    const acknowledgement = createChartRenderCycle(controller, id, currentCycle);
    const events = props.options?.chart?.events;
    const mounted: LifecycleEvent = function (this: unknown, ...args) {
      try { events?.mounted?.apply(this, args); } finally { hasRendered.current = true; acknowledgement.complete(); }
    };
    const updated: LifecycleEvent = function (this: unknown, ...args) {
      try { events?.updated?.apply(this, args); } finally { hasRendered.current = true; acknowledgement.complete(); }
    };
    return {
      acknowledgement,
      options: {
        ...props.options,
        chart: {
          ...props.options?.chart,
          animations: { ...props.options?.chart?.animations, enabled: false },
          events: { ...events, mounted, updated },
        },
      } satisfies ApexOptions,
    };
    // Series/size changes intentionally create a new lifecycle acknowledgement.
  }, [controller, id, props.options, props.series, props.width, props.height, props.type]);

  useLayoutEffect(() => {
    // Draft filter typing and background redraws must not hide a ready page.
    // Mounts and redraws during an existing foreground barrier do participate.
    cycle.acknowledgement.activate(
      !hasRendered.current || controller?.getSnapshot().phase !== "ready",
    );
    return () => cycle.acknowledgement.dispose();
  }, [controller, cycle]);

  return (
    <Suspense fallback={controller ? null : <UnifiedLoading />}>
      <Chart {...props} options={cycle.options} />
    </Suspense>
  );
}

/**
 * Shared entry for all Apex wrappers and the putaway tray grid. Inside a page or
 * dialog barrier, prepare ALL mounted charts while content remains measurable:
 * viewport-lazy rendering would otherwise show cards before their chart or wait
 * forever for a hidden chart to intersect. Outside a barrier, retain lazy scroll.
 */
export function LazyApexChart(props: ApexChartProps) {
  const controller = useContext(LoadingContext);
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  const [hostWidth, setHostWidth] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [Chart, setChart] = useState(() => InitialApexChart);

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const measure = (value: number) => {
      const next = Math.floor(value);
      // Keep-alive display:none must not replace a valid width with zero.
      if (next > 0) setHostWidth((prev) => Math.abs(prev - next) > 1 ? next : prev);
    };
    measure(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") {
      const resize = () => measure(node.getBoundingClientRect().width);
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const observer = new ResizeObserver((entries) => {
      measure(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (controller) return;
    const node = hostRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [controller]);

  const height = typeof props.height === "number" ? props.height : undefined;
  const width = (() => {
    if (hostWidth <= 0) return props.width;
    if (typeof props.width === "number") return Math.min(props.width, hostWidth);
    if (props.width === undefined || props.width === "100%") return hostWidth;
    return props.width;
  })();
  // Preserve inline-size containment: without it a stale canvas prevents shrink.
  const hostStyle: CSSProperties = {
    contain: "inline-size", width: "100%", minWidth: 0,
    display: "flex", justifyContent: "center",
    ...(height !== undefined ? { minHeight: height } : null),
  };
  const retry = () => {
    // React.lazy caches rejected promises. A retry needs a fresh lazy wrapper.
    setChart(() => lazy(loadChart));
    setAttempt((value) => value + 1);
  };

  return (
    <div ref={hostRef} style={hostStyle} data-chart-loading="coordinated">
      {controller || near ? (
        <ChartErrorBoundary key={attempt} fallback={
          <UiStateSurface kind="error" action={
            <button type="button" className="hn-loading-boundary__retry" onClick={retry}>
              {t("common.retry")}
            </button>
          } />
        }>
          {/* Width remount is retained for Apex's responsive canvas limitation. */}
          <CoordinatedChart
            key={typeof width === "number" ? width : "auto"}
            Chart={Chart}
            {...props}
            width={width}
          />
        </ChartErrorBoundary>
      ) : <div style={height !== undefined ? { height } : undefined} aria-hidden="true" />}
    </div>
  );
}

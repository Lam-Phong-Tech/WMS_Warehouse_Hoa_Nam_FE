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
  type CSSProperties,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import type { Props as ApexChartProps } from "react-apexcharts";
import { LoadingContext } from "@/shared/ui/loading/loading-context";
import { createChartRenderCycle } from "@/shared/ui/loading/chart-render-cycle";
import { UnifiedLoading } from "@/shared/ui/loading/UnifiedLoading";
import { UiStateSurface } from "@/shared/ui/components/UiStateSurface";
import { useT } from "@/shared/i18n/useT";

const loadChart = () => import("./ApexChartRenderer");
const InitialApexChart = lazy(loadChart);
type ChartComponent = Awaited<ReturnType<typeof loadChart>>["default"];

/** A failed module/draw settles the screen into an error with an explicit retry. */
class ChartErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** The module AND the latest committed engine draw own one presentation ticket. */
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
    return {
      acknowledgement,
      ready: () => {
        hasRendered.current = true;
        acknowledgement.complete();
      },
    };
    // Each committed input has its own completion callback, even for equal data.
  }, [controller, id, props.options, props.series, props.width, props.height, props.type]);

  useLayoutEffect(() => {
    // Activity/StrictMode recreates the engine's effects. On reactivation, wait
    // for that fresh draw rather than trusting the SVG destroyed during cleanup.
    return () => { hasRendered.current = false; };
  }, []);

  useLayoutEffect(() => {
    // Background redraws stay registered without hiding a ready page. A refresh
    // that starts before they finish will wait for them automatically.
    cycle.acknowledgement.activate(true, hasRendered.current ? "foreground" : "always");
    return () => cycle.acknowledgement.dispose();
  }, [cycle]);

  return (
    <Suspense fallback={controller ? null : <UnifiedLoading />}>
      <Chart {...props} onRenderReady={cycle.ready} />
    </Suspense>
  );
}

/**
 * Shared entry for all Apex wrappers and the putaway tray grid. Inside a page or
 * dialog barrier, prepare all mounted charts while the content is measurable.
 * Outside a barrier, retain viewport-lazy rendering to avoid needless work.
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
  const hostStyle: CSSProperties = {
    contain: "inline-size", width: "100%", minWidth: 0,
    display: "flex", justifyContent: "center",
    ...(height !== undefined ? { minHeight: height } : null),
  };
  const retry = () => {
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
          {/* Preserve the width remount needed by the responsive canvas. */}
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

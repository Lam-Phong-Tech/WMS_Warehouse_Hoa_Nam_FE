import { useEffect, useRef, useState } from "react";
import ApexCharts from "apexcharts/client";
import type { ApexOptions } from "apexcharts";
import type { Props as ApexChartProps } from "react-apexcharts";
import {
  copyChartConfig,
  createChartRenderRuntime,
  equalChartConfig,
} from "./chart-render-runtime";

export type ApexChartRendererProps = ApexChartProps & {
  onRenderReady: () => void;
};

/**
 * Lazy-loaded engine adapter. React's error boundary does not catch rejected
 * render/update promises, so convert those outcomes to a render-time error.
 * Public chart props/events remain unchanged; only readiness is owned here.
 */
export default function ApexChartRenderer({
  type = "line",
  width = "100%",
  height = "auto",
  options,
  series,
  chartRef,
  onRenderReady,
  ...rest
}: ApexChartRendererProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const runtime = useRef<ReturnType<typeof createChartRenderRuntime<ApexOptions>> | null>(null);
  const [failure, setFailure] = useState<{ reason: unknown } | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const scope = createChartRenderRuntime<ApexOptions>({
      create: (config) => {
        const chart = new ApexCharts(node, config);
        if (chartRef) chartRef.current = chart;
        return {
          render: () => chart.render(),
          update: (next) => chart.updateOptions(next, false, false),
          destroy: () => {
            try { chart.destroy(); } finally {
              if (chartRef?.current === chart) chartRef.current = null;
            }
          },
        };
      },
      equal: equalChartConfig,
      copy: copyChartConfig,
    });
    runtime.current = scope;
    return () => {
      scope.dispose();
      if (runtime.current === scope) runtime.current = null;
    };
  }, [chartRef]);

  useEffect(() => {
    const config: ApexOptions = {
      ...options,
      chart: {
        ...options?.chart,
        type, width, height,
        animations: { ...options?.chart?.animations, enabled: false },
      },
      series,
    };
    runtime.current?.draw(config, onRenderReady, (reason) => setFailure({ reason }));
  }, [chartRef, height, onRenderReady, options, series, type, width]);

  if (failure) {
    throw failure.reason instanceof Error ? failure.reason : new Error("Chart rendering failed");
  }
  return <div ref={host} {...rest} />;
}

/** Shared report refresh: real read lifetime, one screen gate, no cosmetic delay. */
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { useT } from "@/shared/i18n/useT";
import { useForegroundRead } from "@/shared/ui/loading/useForegroundRead";
import { reportRefreshResult } from "./report-refresh-result";

export type ReportRefreshOptions = {
  /** Return the promise for every data source being refreshed. */
  refetch: () => unknown;
  /** Fallback for services that do not return React Query result objects. */
  readError?: () => unknown;
  beforeRefetch?: () => void;
  successMessage?: string;
};

export type ReportRefreshState = {
  refreshing: boolean;
  refresh: () => void;
};

export function useReportRefresh({
  refetch,
  readError,
  beforeRefetch,
  successMessage,
}: ReportRefreshOptions): ReportRefreshState {
  const t = useT();
  const runRead = useForegroundRead();
  const [refreshing, setRefreshing] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(false);
  const readErrorRef = useRef(readError);

  useLayoutEffect(() => {
    readErrorRef.current = readError;
  }, [readError]);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    if (runningRef.current || !mountedRef.current) return;
    runningRef.current = true;
    setRefreshing(true);

    void (async () => {
      try {
        const value = await runRead(() => {
          beforeRefetch?.();
          return refetch();
        });
        if (!mountedRef.current) return;
        const outcome = reportRefreshResult(value);
        const error =
          outcome.kind === "error"
            ? outcome.error
            : outcome.kind === "unknown"
              ? readErrorRef.current?.()
              : null;
        if (error !== null && error !== undefined) {
          toast.error(
            getApiErrorMessage(error, t("reports.common.refreshFailed")),
          );
          return;
        }
        toast.success(
          successMessage ??
            t("reports.common.refreshOk", { time: dayjs().format("HH:mm") }),
        );
      } catch (error) {
        if (mountedRef.current) {
          toast.error(
            getApiErrorMessage(error, t("reports.common.refreshFailed")),
          );
        }
      } finally {
        runningRef.current = false;
        // Activity preserves state while hidden; settle it even when not visible.
        setRefreshing(false);
      }
    })();
  }, [refetch, beforeRefetch, successMessage, t, runRead]);

  return { refreshing, refresh };
}

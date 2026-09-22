import type { MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import IoHistoryReport from "@/modules/reports/io-history/IoHistoryReport";
import Rpt08HistoryReport from "@/modules/reports/io-history/rpt08/Rpt08HistoryReport";

const PREVIEW_STATE_KEYS = ["state", "io-state", "variant"] as const;

function normalizePreviewState(params: URLSearchParams): string {
  return (
    PREVIEW_STATE_KEYS.map((key) => params.get(key))
      .find((value) => Boolean(value?.trim()))
      ?.trim()
      .toLowerCase() ?? ""
  );
}

/**
 * RPT-08 — route /reports/pending-evidence.
 *
 * `screen=RPT-08` và các tham số state chỉ bật lớp UI đối chiếu Golden Master.
 * Route nghiệp vụ không có các tham số này vẫn dùng nguyên component vận hành
 * hiện hữu, nên API, quyền, export, bộ lọc, đối soát và luồng chi tiết không bị
 * thay đổi bởi batch đồng bộ giao diện.
 */
export default function PendingEvidenceReportPage() {
  const [params, setParams] = useSearchParams();
  const isRPT08Preview = params.get("screen")?.trim().toUpperCase() === "RPT-08";
  const previewState = normalizePreviewState(params);
  const hasPreviewState = previewState !== "";

  const clearPreviewState = () => {
    const next = new URLSearchParams(params);
    PREVIEW_STATE_KEYS.forEach((key) => next.delete(key));
    setParams(next, { replace: true });
  };

  const handlePreviewAction = (event: MouseEvent<HTMLDivElement>) => {
    if (!hasPreviewState) return;
    const target = event.target as HTMLElement;
    const clearsNoResult = target.closest(".rpt08-table-empty.is-search button");
    const clearsEmpty = target.closest(".rpt08-table-empty:not(.is-search) button");
    const retriesLoad = target.closest(".rpt08-load-error button");
    const resetsInvalid =
      ["invalid", "invalid-date", "invalid-date-range", "p09"].includes(
        previewState,
      ) && target.closest(".rpt08-reset-button");

    if (clearsNoResult || clearsEmpty || retriesLoad || resetsInvalid) {
      clearPreviewState();
    }
  };

  return (
    <div
      data-testid="wwhn-258-report-screen"
      onClickCapture={handlePreviewAction}
    >
      {isRPT08Preview || hasPreviewState ? (
        <Rpt08HistoryReport
          key={`${isRPT08Preview ? "rpt08" : "state"}:${previewState || "default"}`}
        />
      ) : (
        <IoHistoryReport />
      )}
    </div>
  );
}

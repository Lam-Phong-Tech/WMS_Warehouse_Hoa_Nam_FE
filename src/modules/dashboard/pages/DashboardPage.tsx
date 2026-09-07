/**
 * MÀN "TỔNG QUAN VẬN HÀNH" (MAP-01) — dựng theo demo UI/UX đã chốt
 * `10.WMS_Hoa_Nam_Trang_Tong_Quan.html`: cùng cấu trúc khối, cùng class, cùng
 * số đo (CSS port ở `../dashboard-overview.css`).
 *
 * KHÁC DEMO Ở ĐÂU (và vì sao):
 *  · Demo chạy trên fixture cứng + có bảng "Prototype QA controls" và hộp thoại
 *    chặn điều hướng — cả hai được demo ghi rõ "không đưa vào production" nên
 *    không port; các nút ở đây điều hướng THẬT bằng ROUTES của dự án.
 *  · Mọi con số đến từ 4 endpoint thật (xem `../overview/overview-data.ts`).
 *    Không có KPI nào được suy diễn; nguồn nào chưa trả thì widget hiện trạng
 *    thái tương ứng thay vì thay bằng 0.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import { checkDate, pastDateBounds } from "@/shared/validation/date-rules";
import type { SkuTypeFilter } from "../types";
import type { MessageKey } from "@/shared/i18n/messages";
import "../dashboard-overview.css";
import { OverviewFilters } from "../overview/OverviewFilters";
import {
  OverviewKpiGrid,
  type KpiCardModel,
} from "../overview/OverviewKpiGrid";
import {
  OverviewOperations,
  type AlertRow,
  type IssueRow,
} from "../overview/OverviewOperations";
import { OverviewEquation } from "../overview/OverviewEquation";
import { OverviewFlowChart } from "../overview/OverviewFlowChart";
import { OverviewStockMix } from "../overview/OverviewStockMix";
import { OverviewComposition } from "../overview/OverviewComposition";
import { OverviewThreshold } from "../overview/OverviewThreshold";
import { OverviewInsights, type SignalRow } from "../overview/OverviewInsights";
import { useLazyReveal } from "../overview/use-lazy-reveal";
import {
  PERIOD_NAME_KEYS,
  buildComposition,
  chartRangeOf,
  buildEquation,
  buildFlowRows,
  buildTopSkus,
  buildStockMix,
  buildTrendRows,
  countActiveWarranty,
  countSkusInStock,
  fmtDelta,
  oldestOverdueDays,
  overviewTypeKey,
  resolvePeriodRange,
  sumFlow,
  sumPreviousFlow,
  trendOf,
  useOverviewSource,
  type DateRange,
  type OverviewPeriod,
} from "../overview/overview-data";

const ISO = "YYYY-MM-DD";

const SKU_TYPE_KEYS: Record<SkuTypeFilter, MessageKey> = {
  ALL: "dashboard.skuType.all",
  PRODUCT: "dashboard.skuType.product",
  COMPONENT: "dashboard.skuType.component",
};

function httpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/** Delta "so với kỳ trước": % khi kỳ trước có số, còn lại là chênh tuyệt đối. */
function periodDelta(
  current: number,
  previous: number,
): { text: string; trend: ReturnType<typeof trendOf> } {
  if (previous > 0) {
    const pct = ((current - previous) / previous) * 100;
    return {
      text: fmtDelta(Math.round(pct * 10) / 10, "%"),
      trend: trendOf(pct),
    };
  }
  return { text: fmtDelta(current), trend: trendOf(current) };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);
  const t = useT();

  const canViewReport =
    !isProfileLoaded || isSuperAdmin || permissionCodes.includes("report.view");
  /**
   * Mọi nội dung BẢO HÀNH của màn tổng quan (thẻ "Hồ sơ bảo hành cần theo dõi",
   * dòng việc P1 "Hồ sơ bảo hành quá hạn", tín hiệu cảnh báo quá hạn) chỉ hiện
   * cho vai đọc được hồ sơ bảo hành. Nhân viên kho KHÔNG có `warranty.view`:
   * cả ba khối đều dẫn sang /warranty — màn mà RequirePermission chặn — nên với
   * họ đó là số liệu không tra ngược được và một nút bấm vào là 403.
   *
   * `/reports/dashboard-overview` vẫn trả khối warranty cho mọi vai có
   * `report.view`; đây là gate HIỂN THỊ, không phải gate dữ liệu.
   */
  const canViewWarranty =
    !isProfileLoaded ||
    isSuperAdmin ||
    permissionCodes.includes("warranty.view") ||
    permissionCodes.includes("warranty.manage");

  /**
   * Kỳ mặc định là "7 ngày qua", KHÔNG phải "Hôm nay": kho có những ngày
   * không phát sinh phiếu xuất nào, khi đó "Top 5 SKU xuất" và các KPI xuất kho
   * rỗng ngay lần mở đầu tiên — người xem tưởng hỏng dữ liệu chứ không phải
   * "hôm nay chưa xuất hàng". Cửa sổ 7 ngày luôn bắt được nhịp vận hành thật của
   * kho, lại khớp đúng cửa sổ cố định của biểu đồ luồng (chartRangeOf). Ai cần
   * đúng số của hôm nay vẫn chọn được ở bộ lọc kỳ.
   */
  const [period, setPeriod] = useState<OverviewPeriod>("last7");
  const [type, setType] = useState<SkuTypeFilter>("ALL");
  const [custom, setCustom] = useState<DateRange>(() => ({
    from: dayjs().subtract(7, "day").format(ISO),
    to: dayjs().format(ISO),
  }));

  const today = dayjs().format(ISO);
  const dateError = useMemo(() => {
    if (period !== "custom") return "";
    if (!custom.from || !custom.to) return t("dashboard.dateError.required");
    if (custom.from > custom.to) return t("dashboard.dateError.order");
    if (custom.to > today) return t("dashboard.dateError.future");
    // Chốt chặn chung (2000 → hôm nay, chuỗi ISO sai như "2026-22-01"): so
    // chuỗi ở trên không bắt được các trường hợp này.
    // Truyền CHUỖI để checkDate parse nghiêm ngặt (dayjs() tự cuộn 31/02 → 03/03).
    for (const raw of [custom.from, custom.to]) {
      const check = checkDate(raw, pastDateBounds());
      if (!check.ok) return check.message;
    }
    return "";
  }, [period, custom, today, t]);

  const range = useMemo(
    () => resolvePeriodRange(period, custom),
    [period, custom],
  );
  /**
   * Cửa sổ biểu đồ cố định 7 ngày, tách khỏi kỳ KPI (xem `chartRangeOf`).
   * `today` là chuỗi ISO nên memo chỉ tính lại khi sang ngày mới.
   */
  const chartRange = useMemo(() => chartRangeOf(dayjs(today)), [today]);

  const enabled = canViewReport && dateError === "";
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const { overview, xnt, xntDaily, quick } = useOverviewSource(
    range,
    chartRange,
    enabled,
    !offline,
  );

  // Vùng aria-live: mỗi thao tác đổi dữ liệu được xướng thành lời.
  const [announcement, setAnnouncement] = useState("");
  const revealAnalysis = useLazyReveal();
  const revealInsight = useLazyReveal();

  useEffect(() => {
    const online = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", down);
    };
  }, []);

  const status = httpStatus(overview.error);
  const forbidden = (isProfileLoaded && !canViewReport) || status === 403;
  const loading = enabled && overview.isLoading;
  const failed = overview.isError && !forbidden;
  const partial =
    !failed && !forbidden && (xnt.isError || xntDaily.isError || quick.isError);

  /**
   * "Đang bận" tính trên CẢ BỐN nguồn, không riêng nguồn chính.
   *
   * Bản trước chỉ nhìn `overview.isFetching`: nút Làm mới sáng lại ngay khi
   * nguồn chính về, trong lúc ba nguồn kia còn đang bay — bấm phát nữa là nhân
   * đôi request.
   */
  const busy =
    overview.isFetching ||
    xnt.isFetching ||
    xntDaily.isFetching ||
    quick.isFetching;

  /**
   * Làm mới thủ công phải NHÌN THẤY được. Bản trước chỉ hiện banner "Đang thử
   * lại" khi đã có lỗi từ trước, nên bấm Làm mới trên trang khoẻ mạnh thì
   * ngoài việc nút xám đi là không có phản hồi nào.
   *
   * Vòng tự làm mới 60 giây thì KHÔNG hiện banner — nó chạy ngầm, nhấp nháy
   * mỗi phút chỉ gây nhiễu.
   */
  const [manualRefresh, setManualRefresh] = useState(false);
  const retrying = (overview.isError && overview.isFetching) || manualRefresh;

  const overviewData = overview.data;

  /**
   * HAI bộ chuỗi khác cửa sổ, cùng một payload đã nới — không thêm request:
   *  · `kpiFlowRows` theo kỳ KPI, chỉ để cộng ra CON SỐ của thẻ KPI.
   *  · `chartFlowRows` / `trendRows` theo cửa sổ 7 ngày, để VẼ.
   * Gộp hai thứ này làm một chính là chỗ khiến kỳ "Hôm nay" ra biểu đồ trống.
   */
  const kpiFlowRows = useMemo(
    () => buildFlowRows(overviewData, xntDaily.data, range, type),
    [overviewData, xntDaily.data, range, type],
  );
  const chartFlowRows = useMemo(
    () => buildFlowRows(overviewData, xntDaily.data, chartRange, type),
    [overviewData, xntDaily.data, chartRange, type],
  );
  const flowTotals = useMemo(() => sumFlow(kpiFlowRows), [kpiFlowRows]);
  const previousTotals = useMemo(
    () => sumPreviousFlow(overviewData, range, type),
    [overviewData, range, type],
  );
  const trendRows = useMemo(
    () => buildTrendRows(overviewData, chartRange),
    [overviewData, chartRange],
  );
  const equation = useMemo(() => buildEquation(xnt.data), [xnt.data]);
  const topSkus = useMemo(() => buildTopSkus(xnt.data), [xnt.data]);
  const skuCounts = useMemo(() => countSkusInStock(xnt.data), [xnt.data]);
  const composition = useMemo(
    () => buildComposition(overviewData, type),
    [overviewData, type],
  );
  // Cố ý KHÔNG phụ thuộc `type`: xem ghi chú ở `buildStockMix`.
  const stockMix = useMemo(() => buildStockMix(overviewData), [overviewData]);

  const typeKey = overviewTypeKey(type);
  const onHand = overviewData?.kpi.on_hand[typeKey] ?? null;
  const onHandDelta =
    flowTotals.inbound - flowTotals.product - flowTotals.component;

  const kpiCards = useMemo<KpiCardModel[]>(() => {
    const receiptDelta = periodDelta(
      flowTotals.inbound,
      previousTotals.inbound,
    );
    const productDelta = periodDelta(
      flowTotals.product,
      previousTotals.product,
    );
    const componentDelta = periodDelta(
      flowTotals.component,
      previousTotals.component,
    );
    const skuDelta = skuCounts.closing - skuCounts.opening;

    const cards: KpiCardModel[] = [
      {
        id: "DASH-KPI-01",
        label: t("dashboard.kpi.onHand"),
        value: onHand,
        delta: fmtDelta(onHandDelta),
        trend: trendOf(onHandDelta),
        note: t("dashboard.kpi.onHandNote"),
        icon: "layout-dashboard",
        spark:
          type === "ALL"
            ? trendRows.map((row) => row.closing)
            : chartFlowRows.reduce<number[]>((series, row) => {
                const previous = series.at(-1) ?? 0;
                series.push(
                  previous + row.inbound - row.product - row.component,
                );
                return series;
              }, []),
        source: "reports/dashboard-overview",
      },
      {
        id: "DASH-KPI-02",
        label: t("dashboard.kpi.skuInStock"),
        value: xnt.isError ? null : skuCounts.closing,
        delta: xnt.isError ? null : fmtDelta(skuDelta),
        trend: trendOf(skuDelta),
        note: t("dashboard.kpi.skuInStockNote"),
        icon: "package-search",
        spark: [],
        source: "reports/inventory-xnt-enhanced",
      },
      {
        id: "DASH-KPI-03",
        label: t("dashboard.kpi.receipt"),
        value: flowTotals.inbound,
        delta: receiptDelta.text,
        trend: receiptDelta.trend,
        note: t("dashboard.kpi.notePreviousPeriod"),
        icon: "package-plus",
        spark: chartFlowRows.map((row) => row.inbound),
        source: "reports/dashboard-overview",
      },
      {
        id: "DASH-KPI-04",
        label: t("dashboard.kpi.issueProduct"),
        value: flowTotals.product,
        delta: productDelta.text,
        trend: productDelta.trend,
        note: t("dashboard.kpi.notePreviousPeriod"),
        icon: "package-minus",
        spark: chartFlowRows.map((row) => row.product),
        source: "reports/dashboard-overview",
      },
      {
        id: "DASH-KPI-05",
        label: t("dashboard.kpi.issueComponent"),
        value: flowTotals.component,
        delta: componentDelta.text,
        trend: componentDelta.trend,
        note: t("dashboard.kpi.notePreviousPeriod"),
        icon: "briefcase-medical",
        spark: chartFlowRows.map((row) => row.component),
        source: "reports/dashboard-overview",
      },
    ];

    // Đúng demo: lọc Sản phẩm thì bỏ thẻ xuất linh kiện và ngược lại.
    if (type === "PRODUCT")
      return cards.filter((card) => card.id !== "DASH-KPI-05");
    if (type === "COMPONENT")
      return cards.filter((card) => card.id !== "DASH-KPI-04");
    return cards;
  }, [
    flowTotals,
    previousTotals,
    chartFlowRows,
    trendRows,
    onHand,
    onHandDelta,
    skuCounts,
    type,
    xnt.isError,
    t,
  ]);

  const issues = useMemo<IssueRow[]>(() => {
    const source = overviewData?.issues;
    if (!source) return [];
    const overdue = overviewData?.warranty.overdue_count ?? 0;
    const rows: IssueRow[] = [
      {
        id: "DASH-KPI-14",
        severity: "P0",
        title: t("dashboard.issue.mismatchTitle"),
        detail: t("dashboard.issue.mismatchDetail"),
        technical: "Distinct incident",
        count: source.inventory_mismatch,
        route: ROUTES.INVENTORY,
      },
      ...(canViewWarranty
        ? [
            {
              id: "DASH-KPI-15",
              severity: "P1" as const,
              title: t("dashboard.issue.warrantyTitle"),
              detail: t("dashboard.issue.warrantyDetail", { count: overdue }),
              technical: "Active / overdue",
              count: source.warranty_overdue,
              route: ROUTES.WARRANTY,
            },
          ]
        : []),
      {
        id: "DASH-KPI-13",
        severity: "P1",
        title: t("dashboard.issue.labelTitle"),
        detail: t("dashboard.issue.labelDetail"),
        technical: "Latest snapshot sau Post",
        count: source.print_failed,
        route: ROUTES.OUTBOUND,
      },
      {
        id: "DASH-KPI-17",
        severity: "P1",
        title: t("dashboard.issue.importTitle"),
        detail: t("dashboard.issue.importDetail"),
        technical: "Import / match telemetry",
        count: source.import_error,
        route: ROUTES.REPORTS_IMPORT_QUALITY,
      },
      {
        id: "DASH-KPI-16",
        severity: "P2",
        title: t("dashboard.issue.skuTitle"),
        detail: t("dashboard.issue.skuDetail"),
        technical: "PENDING_ENRICHMENT / no PII",
        count: source.sku_pending_info,
        route: ROUTES.MASTER_DATA,
      },
    ];
    // Demo chỉ liệt kê việc CÓ số lượng — không dựng dòng rỗng cho vui mắt.
    return rows.filter((row) => row.count > 0);
  }, [overviewData, canViewWarranty, t]);

  const alerts = useMemo<AlertRow[]>(() => {
    if (!overviewData) return [];
    const rows: AlertRow[] = [];
    const mismatch = overviewData.issues.inventory_mismatch;
    if (mismatch > 0)
      rows.push({
        title: t("dashboard.signal.mismatchTitle", { count: mismatch }),
        copy: t("dashboard.signal.mismatchCopy"),
        action: t("dashboard.signal.mismatchAction"),
        route: ROUTES.INVENTORY,
      });
    const overdue = overviewData.warranty.overdue_count;
    if (overdue > 0 && canViewWarranty)
      rows.push({
        title: t("dashboard.signal.warrantyTitle", { count: overdue }),
        copy: t("dashboard.signal.warrantyCopy", {
          days: oldestOverdueDays(overviewData),
        }),
        action: t("dashboard.signal.warrantyAction"),
        route: ROUTES.WARRANTY,
      });
    const belowMin = quick.data?.below_min_stock_count ?? 0;
    if (belowMin > 0)
      rows.push({
        title: t("dashboard.signal.belowMinTitle", { count: belowMin }),
        copy: t("dashboard.signal.belowMinCopy"),
        action: t("dashboard.signal.belowMinAction"),
        route: ROUTES.INVENTORY,
      });
    return rows;
  }, [overviewData, quick.data, canViewWarranty, t]);

  const lastUpdatedAt = overview.dataUpdatedAt
    ? dayjs(overview.dataUpdatedAt)
    : null;
  const lastUpdatedLabel = lastUpdatedAt
    ? t("dashboard.lastUpdated.at", { time: lastUpdatedAt.format("HH:mm") })
    : t("dashboard.lastUpdated.none");
  const stale =
    lastUpdatedAt !== null && dayjs().diff(lastUpdatedAt, "minute") >= 60;

  const signals = useMemo<SignalRow[]>(
    () => [
      {
        id: "DASH-KPI-16",
        name: t("dashboard.insight.rowSkuPending"),
        value: String(overviewData?.issues.sku_pending_info ?? 0),
        icon: "package-search",
      },
      {
        id: "DASH-KPI-17",
        name: t("dashboard.insight.rowImportError"),
        value: String(overviewData?.issues.import_error ?? 0),
        icon: "settings-2",
      },
      {
        id: "DASH-KPI-21",
        name: t("dashboard.insight.rowLastUpdated"),
        value: lastUpdatedAt ? lastUpdatedAt.format("HH:mm") : EMPTY_TEXT,
        icon: "file-clock",
      },
    ],
    [overviewData, lastUpdatedAt, t],
  );

  const pageAlert = useMemo(() => {
    if (forbidden)
      return {
        copy: t("dashboard.alert.forbidden"),
        tone: "is-error",
        badge: t("dashboard.alert.forbiddenBadge"),
        badgeTone: "chip-error",
      };
    if (failed)
      return {
        copy: t("dashboard.alert.failed"),
        tone: "is-error",
        badge: t("dashboard.alert.failedBadge"),
        badgeTone: "chip-error",
      };
    if (retrying)
      return {
        copy: t("dashboard.alert.retrying"),
        tone: "is-info",
        badge: t("dashboard.alert.retryingBadge"),
        badgeTone: "chip-info",
      };
    if (partial)
      return {
        copy: t("dashboard.alert.partial"),
        tone: "is-error",
        badge: t("dashboard.alert.partialBadge"),
        badgeTone: "chip-error",
      };
    if (offline)
      return {
        copy: t("dashboard.alert.offline"),
        tone: "is-info",
        badge: t("dashboard.alert.offlineBadge"),
        badgeTone: "chip-info",
      };
    if (stale)
      return {
        copy: t("dashboard.alert.stale", { updated: lastUpdatedLabel }),
        tone: "",
        badge: t("dashboard.alert.staleBadge"),
        badgeTone: "chip-warning",
      };
    return null;
  }, [
    forbidden,
    failed,
    retrying,
    partial,
    offline,
    stale,
    lastUpdatedLabel,
    t,
  ]);

  const scopeLabel =
    overviewData?.data_scope === "WAREHOUSE_SCOPED"
      ? t("dashboard.scope.warehouses", {
          count: overviewData.scope_warehouse_ids?.length ?? 0,
        })
      : t("dashboard.scope.all");
  const roleLabel = isSuperAdmin
    ? t("dashboard.scope.roleSuperAdmin")
    : t("dashboard.scope.roleOperator");

  const refreshAll = () => {
    setManualRefresh(true);
    // Dọn cờ khi CẢ BỐN nguồn đã lắng, thay vì bám `busy` qua một effect:
    // effect sẽ đặt state đồng bộ trong lúc render (cascading render), còn bám
    // `busy` thì thua cuộc đua — lần render ngay sau cú bấm có thể chưa kịp
    // thấy nguồn nào đang bay và xoá cờ mất.
    void Promise.allSettled([
      overview.refetch(),
      xnt.refetch(),
      xntDaily.refetch(),
      quick.refetch(),
    ]).finally(() => setManualRefresh(false));
    setAnnouncement(t("dashboard.live.refreshed"));
  };

  const changePeriod = (next: OverviewPeriod) => {
    setPeriod(next);
    setAnnouncement(
      t("dashboard.live.periodChanged", { period: t(PERIOD_NAME_KEYS[next]) }),
    );
  };

  const changeType = (next: SkuTypeFilter) => {
    setType(next);
    setAnnouncement(
      t("dashboard.live.typeChanged", { type: t(SKU_TYPE_KEYS[next]) }),
    );
  };

  const changeCustom = (next: DateRange) => {
    setCustom(next);
    setAnnouncement(
      t("dashboard.live.dateChanged", { from: next.from, to: next.to }),
    );
  };

  const periodName = t(PERIOD_NAME_KEYS[period]);
  const formatRange = (value: DateRange) =>
    `${dayjs(value.from).format("DD-MM-YYYY")} → ${dayjs(value.to).format("DD-MM-YYYY")}`;
  const cutoffLabel = formatRange(range);
  const chartCutoffLabel = formatRange(chartRange);
  /**
   * Khoảng ngày thật của kỳ đang chọn + số ngày, hiện ngay dưới dải nút kỳ.
   * Nút chỉ nói luật ("Tháng này"), dòng này nói kết quả — mùng 4 bấm "Tháng
   * này" là 4 ngày chứ không phải cả tháng.
   */
  const rangeLabel = t("shared.datePicker.rangeSummary", {
    from: dayjs(range.from).format("DD/MM/YYYY"),
    to: dayjs(range.to).format("DD/MM/YYYY"),
    days: dayjs(range.to).diff(dayjs(range.from), "day") + 1,
  });

  return (
    <div className="hn-dash" data-mvp-screen="MAP-01">
      <div className="page-wrap">
        <div className="breadcrumb" aria-label={t("dashboard.breadcrumb.nav")}>
          <span>{t("dashboard.breadcrumb.home")}</span>
          <span aria-hidden="true">/</span>
          <strong>{t("dashboard.breadcrumb.current")}</strong>
        </div>

        <section className="page-header" aria-labelledby="page-title">
          <div>
            <div className="eyebrow">{t("dashboard.eyebrow")}</div>
            <h1 id="page-title">{t("dashboard.heading")}</h1>
            <p>{t("dashboard.lead")}</p>
          </div>
          <div className="scope-block">
            <span className="chip chip-primary">{scopeLabel}</span>
            <span className="chip chip-neutral">{roleLabel}</span>
            <span
              className={`chip ${pageAlert?.badgeTone ?? "chip-success"}`}
              data-kpi-id="DASH-KPI-21"
            >
              {pageAlert?.badge ?? t("dashboard.scope.badgeFresh")}
            </span>
          </div>
        </section>

        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>

        {/*
          Không có quyền đọc số liệu -> BỎ HẲN phần thân, không render thẻ khoá
          "Không có quyền xem" nữa (yêu cầu người dùng 07/09/2026).
          Trước đây mỗi widget tự vẽ một OverviewStateBox kind="forbidden", nên màn
          hình đầy thẻ khoá + banner đỏ — nhiễu mà không cho người xem thêm hành động
          nào. Bộ lọc kỳ cũng ẩn theo vì nó chỉ tồn tại để đổi tham số truy vấn.

          Chip trạng thái ở header vẫn giữ badge "forbidden", đó là chỗ DUY NHẤT còn
          nói ra lý do màn trống — bỏ nốt thì không phân biệt được với lúc mất mạng.
        */}
        {forbidden ? null : (
          <>
            <OverviewFilters
              period={period}
              onPeriodChange={changePeriod}
              rangeLabel={rangeLabel}
              custom={custom}
              onCustomChange={changeCustom}
              dateError={dateError}
              type={type}
              onTypeChange={changeType}
              lastUpdatedLabel={lastUpdatedLabel}
              refreshing={busy || manualRefresh}
              onRefresh={refreshAll}
            />

            {pageAlert ? (
              <div
                className={`page-alert ${pageAlert.tone}`}
                role="status"
                aria-live="polite"
              >
                {pageAlert.copy}
              </div>
            ) : null}

            <section aria-labelledby="quick-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {t("dashboard.section.quickEyebrow")}
                  </span>
                  <h2 id="quick-title">{t("dashboard.section.quickTitle")}</h2>
                </div>
                <span className="section-meta">
                  {t("dashboard.section.quickMeta", {
                    period: periodName,
                    range: chartCutoffLabel,
                  })}
                </span>
              </div>
              <OverviewKpiGrid
                cards={kpiCards}
                periodName={periodName}
                loading={loading}
                failed={failed}
                forbidden={forbidden}
              />
            </section>

            <OverviewOperations
              issues={issues}
              alerts={alerts}
              loading={loading}
              failed={failed}
              forbidden={forbidden}
              onNavigate={(route) => navigate(route)}
            />

            <section aria-labelledby="reconcile-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {t("dashboard.section.reconcileEyebrow")}
                  </span>
                  <h2 id="reconcile-title">
                    {t("dashboard.section.reconcileTitle")}
                  </h2>
                </div>
                <span className="section-meta">
                  {t("dashboard.section.reconcileMeta", { range: cutoffLabel })}
                </span>
              </div>
              <OverviewEquation
                totals={equation}
                loading={enabled && xnt.isLoading}
                failed={xnt.isError}
                forbidden={forbidden}
              />
            </section>

            <section
              aria-labelledby="analysis-title"
              data-lazy
              ref={revealAnalysis}
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {t("dashboard.section.analysisEyebrow")}
                  </span>
                  <h2 id="analysis-title">
                    {t("dashboard.section.analysisTitle")}
                  </h2>
                </div>
                <span className="section-meta">
                  {t("dashboard.section.analysisMeta")}
                </span>
              </div>
              <div className="analysis-grid">
                <OverviewFlowChart
                  rows={chartFlowRows}
                  loading={loading}
                  failed={failed}
                  forbidden={forbidden}
                />
                <OverviewStockMix
                  rows={stockMix}
                  loading={loading}
                  failed={failed}
                  forbidden={forbidden}
                />
                <OverviewComposition
                  rows={composition}
                  loading={loading}
                  failed={failed}
                  forbidden={forbidden}
                />
                <OverviewThreshold
                  belowMin={quick.data?.below_min_stock_count ?? null}
                  aboveMax={quick.data?.above_max_stock_count ?? null}
                  loading={enabled && quick.isLoading}
                  failed={quick.isError}
                  forbidden={forbidden}
                />
              </div>
            </section>

            <section
              className="insight-section"
              aria-labelledby="insight-title"
              data-lazy
              ref={revealInsight}
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {t("dashboard.section.insightEyebrow")}
                  </span>
                  <h2 id="insight-title">
                    {t("dashboard.section.insightTitle")}
                  </h2>
                </div>
                <span className="section-meta">
                  {t("dashboard.section.insightMeta")}
                </span>
              </div>
              <OverviewInsights
                showWarranty={canViewWarranty}
                warranty={{
                  active: countActiveWarranty(overviewData),
                  overdue: overviewData?.warranty.overdue_count ?? 0,
                  oldestDays: oldestOverdueDays(overviewData),
                }}
                topSkus={topSkus}
                signals={signals}
                periodLabel={periodName}
                loading={loading}
                failed={failed}
                forbidden={forbidden}
                onNavigate={(route) => navigate(route)}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

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
import type { SkuTypeFilter } from "../types";
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
import { OverviewTrendChart } from "../overview/OverviewTrendChart";
import { OverviewComposition } from "../overview/OverviewComposition";
import { OverviewThreshold } from "../overview/OverviewThreshold";
import { OverviewInsights, type SignalRow } from "../overview/OverviewInsights";
import {
  PERIOD_NAMES,
  buildComposition,
  buildEquation,
  buildFlowRows,
  buildTopSkus,
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

  const canViewReport =
    !isProfileLoaded || isSuperAdmin || permissionCodes.includes("report.view");

  const [period, setPeriod] = useState<OverviewPeriod>("today");
  const [type, setType] = useState<SkuTypeFilter>("ALL");
  const [custom, setCustom] = useState<DateRange>(() => ({
    from: dayjs().subtract(7, "day").format(ISO),
    to: dayjs().format(ISO),
  }));

  const today = dayjs().format(ISO);
  const dateError = useMemo(() => {
    if (period !== "custom") return "";
    if (!custom.from || !custom.to)
      return "Chọn đủ ngày bắt đầu và kết thúc.";
    if (custom.from > custom.to)
      return "Ngày bắt đầu không được sau ngày kết thúc.";
    if (custom.to > today) return "Không chọn ngày actual trong tương lai.";
    return "";
  }, [period, custom, today]);

  const range = useMemo(
    () => resolvePeriodRange(period, custom),
    [period, custom],
  );

  const enabled = canViewReport && dateError === "";
  const { overview, xnt, xntDaily, quick } = useOverviewSource(range, enabled);

  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
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
    !failed &&
    !forbidden &&
    (xnt.isError || xntDaily.isError || quick.isError);
  const retrying = overview.isError && overview.isFetching;

  const overviewData = overview.data;
  const flowRows = useMemo(
    () => buildFlowRows(overviewData, xntDaily.data, range, type),
    [overviewData, xntDaily.data, range, type],
  );
  const flowTotals = useMemo(() => sumFlow(flowRows), [flowRows]);
  const previousTotals = useMemo(
    () => sumPreviousFlow(overviewData, range, type),
    [overviewData, range, type],
  );
  const trendRows = useMemo(
    () => buildTrendRows(overviewData, range),
    [overviewData, range],
  );
  const equation = useMemo(() => buildEquation(xnt.data), [xnt.data]);
  const topSkus = useMemo(() => buildTopSkus(xnt.data), [xnt.data]);
  const skuCounts = useMemo(() => countSkusInStock(xnt.data), [xnt.data]);
  const composition = useMemo(
    () => buildComposition(overviewData, type),
    [overviewData, type],
  );

  const typeKey = overviewTypeKey(type);
  const onHand = overviewData?.kpi.on_hand[typeKey] ?? null;
  const onHandDelta = flowTotals.inbound - flowTotals.product - flowTotals.component;

  const kpiCards = useMemo<KpiCardModel[]>(() => {
    const receiptDelta = periodDelta(flowTotals.inbound, previousTotals.inbound);
    const productDelta = periodDelta(flowTotals.product, previousTotals.product);
    const componentDelta = periodDelta(
      flowTotals.component,
      previousTotals.component,
    );
    const skuDelta = skuCounts.closing - skuCounts.opening;

    const cards: KpiCardModel[] = [
      {
        id: "DASH-KPI-01",
        label: "Tổng tồn khả dụng",
        value: onHand,
        delta: fmtDelta(onHandDelta),
        trend: trendOf(onHandDelta),
        note: "so với đầu kỳ",
        icon: "layout-dashboard",
        spark:
          type === "ALL"
            ? trendRows.map((row) => row.closing)
            : flowRows.reduce<number[]>((series, row) => {
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
        label: "SKU đang có hàng",
        value: xnt.isError ? null : skuCounts.closing,
        delta: xnt.isError ? null : fmtDelta(skuDelta),
        trend: trendOf(skuDelta),
        note: "SKU phát sinh tồn",
        icon: "package-search",
        spark: [],
        source: "reports/inventory-xnt-enhanced",
      },
      {
        id: "DASH-KPI-03",
        label: "Nhập đã Post",
        value: flowTotals.inbound,
        delta: receiptDelta.text,
        trend: receiptDelta.trend,
        note: "so với kỳ trước",
        icon: "package-plus",
        spark: flowRows.map((row) => row.inbound),
        source: "reports/dashboard-overview",
      },
      {
        id: "DASH-KPI-04",
        label: "Xuất sản phẩm đã Post",
        value: flowTotals.product,
        delta: productDelta.text,
        trend: productDelta.trend,
        note: "so với kỳ trước",
        icon: "package-minus",
        spark: flowRows.map((row) => row.product),
        source: "reports/dashboard-overview",
      },
      {
        id: "DASH-KPI-05",
        label: "Xuất linh kiện bảo hành",
        value: flowTotals.component,
        delta: componentDelta.text,
        trend: componentDelta.trend,
        note: "so với kỳ trước",
        icon: "briefcase-medical",
        spark: flowRows.map((row) => row.component),
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
    flowRows,
    trendRows,
    onHand,
    onHandDelta,
    skuCounts,
    type,
    xnt.isError,
  ]);

  const issues = useMemo<IssueRow[]>(() => {
    const source = overviewData?.issues;
    if (!source) return [];
    const overdue = overviewData?.warranty.overdue_count ?? 0;
    const rows: IssueRow[] = [
      {
        id: "DASH-KPI-14",
        severity: "P0",
        title: "Sự cố đối soát tồn",
        detail: "Sự cố chưa được đối soát · Chênh lệch chưa đóng",
        technical: "Distinct incident",
        count: source.inventory_mismatch,
        route: ROUTES.INVENTORY,
      },
      {
        id: "DASH-KPI-15",
        severity: "P1",
        title: "Hồ sơ bảo hành cần xử lý",
        detail: `Đang xử lý · Có ${overdue} hồ sơ quá hạn`,
        technical: "Active / overdue",
        count: source.warranty_overdue,
        route: ROUTES.WARRANTY,
      },
      {
        id: "DASH-KPI-13",
        severity: "P1",
        title: "Nhãn cần xử lý",
        detail: "Dữ liệu mới nhất sau khi ghi nhận · In nhãn chưa thành công",
        technical: "Latest snapshot sau Post",
        count: source.print_failed,
        route: ROUTES.OUTBOUND,
      },
      {
        id: "DASH-KPI-17",
        severity: "P1",
        title: "Lỗi nhập liệu hoặc đối chiếu",
        detail: "Dữ liệu nhập vào chưa khớp · Cần kiểm tra lại",
        technical: "Import / match telemetry",
        count: source.import_error,
        route: ROUTES.REPORTS_IMPORT_QUALITY,
      },
      {
        id: "DASH-KPI-16",
        severity: "P2",
        title: "Sản phẩm chờ bổ sung thông tin",
        detail: "Chưa đủ thông tin sản phẩm · Không chứa dữ liệu cá nhân",
        technical: "PENDING_ENRICHMENT / no PII",
        count: source.sku_pending_info,
        route: ROUTES.MASTER_DATA,
      },
    ];
    // Demo chỉ liệt kê việc CÓ số lượng — không dựng dòng rỗng cho vui mắt.
    return rows.filter((row) => row.count > 0);
  }, [overviewData]);

  const alerts = useMemo<AlertRow[]>(() => {
    if (!overviewData) return [];
    const rows: AlertRow[] = [];
    const mismatch = overviewData.issues.inventory_mismatch;
    if (mismatch > 0)
      rows.push({
        title: `${mismatch} sự cố đối soát tồn`,
        copy: "Chênh lệch giữa sổ và tồn thực tế chưa được đóng.",
        action: "Mở đối soát tồn",
        route: ROUTES.INVENTORY,
      });
    const overdue = overviewData.warranty.overdue_count;
    if (overdue > 0)
      rows.push({
        title: `${overdue} hồ sơ bảo hành quá hạn`,
        copy: `Tuổi hồ sơ cao nhất là ${oldestOverdueDays(overviewData)} ngày.`,
        action: "Mở hồ sơ bảo hành",
        route: ROUTES.WARRANTY,
      });
    const belowMin = quick.data?.below_min_stock_count ?? 0;
    if (belowMin > 0)
      rows.push({
        title: `${belowMin} SKU dưới ngưỡng`,
        copy: "Không bao gồm SKU chưa cấu hình định mức.",
        action: "Mở tồn kho",
        route: ROUTES.INVENTORY,
      });
    return rows;
  }, [overviewData, quick.data]);

  const lastUpdatedAt = overview.dataUpdatedAt
    ? dayjs(overview.dataUpdatedAt)
    : null;
  const lastUpdatedLabel = lastUpdatedAt
    ? `Dữ liệu lúc ${lastUpdatedAt.format("HH:mm")}`
    : "Chưa có dữ liệu";
  const stale =
    lastUpdatedAt !== null && dayjs().diff(lastUpdatedAt, "minute") >= 60;

  const signals = useMemo<SignalRow[]>(
    () => [
      {
        id: "DASH-KPI-16",
        name: "Sản phẩm chờ bổ sung thông tin",
        value: String(overviewData?.issues.sku_pending_info ?? 0),
        icon: "package-search",
      },
      {
        id: "DASH-KPI-17",
        name: "Lỗi nhập liệu hoặc đối chiếu",
        value: String(overviewData?.issues.import_error ?? 0),
        icon: "settings-2",
      },
      {
        id: "DASH-KPI-21",
        name: "Dữ liệu cập nhật gần nhất",
        value: lastUpdatedAt ? lastUpdatedAt.format("HH:mm") : EMPTY_TEXT,
        icon: "file-clock",
      },
    ],
    [overviewData, lastUpdatedAt],
  );

  const pageAlert = useMemo(() => {
    if (forbidden)
      return {
        copy: "Bạn không có quyền report.view nên các widget đọc số liệu đều bị che.",
        tone: "is-error",
        badge: "Giới hạn quyền",
        badgeTone: "chip-error",
      };
    if (failed)
      return {
        copy: "Không thể tải Dashboard từ các nguồn đọc. Không có dữ liệu nào được thay bằng 0; hãy dùng Làm mới để thử lại.",
        tone: "is-error",
        badge: "Lỗi nguồn đọc",
        badgeTone: "chip-error",
      };
    if (retrying)
      return {
        copy: "Đang thử tải lại dữ liệu. Giữ snapshot trước đó cho tới khi xác nhận thành công.",
        tone: "is-info",
        badge: "Đang thử lại",
        badgeTone: "chip-info",
      };
    if (partial)
      return {
        copy: "Lỗi một phần: một nguồn đọc phụ không phản hồi. Không thay số liệu lỗi bằng 0.",
        tone: "is-error",
        badge: "Lỗi một phần",
        badgeTone: "chip-error",
      };
    if (offline)
      return {
        copy: "Bạn đang ngoại tuyến. Dashboard đang hiển thị snapshot đã lưu và tạm dừng làm mới.",
        tone: "is-info",
        badge: "Ngoại tuyến",
        badgeTone: "chip-info",
      };
    if (stale)
      return {
        copy: `${lastUpdatedLabel} · đã quá ngưỡng tươi 60 phút. Không có dữ liệu actual tương lai.`,
        tone: "",
        badge: "Dữ liệu cũ",
        badgeTone: "chip-warning",
      };
    return null;
  }, [forbidden, failed, retrying, partial, offline, stale, lastUpdatedLabel]);

  const scopeLabel =
    overviewData?.data_scope === "WAREHOUSE_SCOPED"
      ? `${overviewData.scope_warehouse_ids?.length ?? 0} kho được phân quyền`
      : "Toàn bộ kho Hoa Nam";
  const roleLabel = isSuperAdmin ? "Super Admin" : "Người dùng vận hành";

  const refreshAll = () => {
    void overview.refetch();
    void xnt.refetch();
    void xntDaily.refetch();
    void quick.refetch();
  };

  const periodName = PERIOD_NAMES[period];
  const cutoffLabel = `${dayjs(range.from).format("DD/MM/YYYY")} → ${dayjs(range.to).format("DD/MM/YYYY")}`;

  return (
    <div className="hn-dash" data-mvp-screen="MAP-01">
      <div className="page-wrap">
        <div className="breadcrumb" aria-label="Đường dẫn">
          <span>Trang chủ</span>
          <span aria-hidden="true">/</span>
          <strong>Tổng quan vận hành</strong>
        </div>

        <section className="page-header" aria-labelledby="page-title">
          <div>
            <div className="eyebrow">TRUNG TÂM ĐIỀU HÀNH</div>
            <h1 id="page-title">Tổng quan vận hành</h1>
            <p>
              Nắm nhanh tình trạng kho, xử lý ngoại lệ và theo dõi luồng hàng.
            </p>
          </div>
          <div className="scope-block">
            <span className="chip chip-primary">{scopeLabel}</span>
            <span className="chip chip-neutral">{roleLabel}</span>
            <span
              className={`chip ${pageAlert?.badgeTone ?? "chip-success"}`}
              data-kpi-id="DASH-KPI-21"
            >
              {pageAlert?.badge ?? "Dữ liệu mới"}
            </span>
          </div>
        </section>

        <OverviewFilters
          period={period}
          onPeriodChange={setPeriod}
          custom={custom}
          onCustomChange={setCustom}
          dateError={dateError}
          type={type}
          onTypeChange={setType}
          lastUpdatedLabel={lastUpdatedLabel}
          refreshing={overview.isFetching}
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
              <span className="eyebrow">TÌNH HÌNH HIỆN TẠI</span>
              <h2 id="quick-title">Tổng quan nhanh</h2>
            </div>
            <span className="section-meta">
              KPI {periodName} · Biểu đồ {cutoffLabel}
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
              <span className="eyebrow">ĐỐI SOÁT TỒN</span>
              <h2 id="reconcile-title">Đối soát tồn theo kỳ</h2>
            </div>
            <span className="section-meta">
              Đơn vị: cái · Toàn bộ loại hàng · Kỳ {cutoffLabel}
            </span>
          </div>
          <OverviewEquation
            totals={equation}
            loading={enabled && xnt.isLoading}
            failed={xnt.isError}
            forbidden={forbidden}
          />
        </section>

        <section aria-labelledby="analysis-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PHÂN TÍCH VẬN HÀNH</span>
              <h2 id="analysis-title">Luồng và xu hướng</h2>
            </div>
            <span className="section-meta">
              Chỉ hiển thị số liệu thực tế đã ghi nhận
            </span>
          </div>
          <div className="analysis-grid">
            <OverviewFlowChart
              rows={flowRows}
              loading={loading}
              failed={failed}
              forbidden={forbidden}
            />
            <OverviewTrendChart
              rows={trendRows}
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

        <section className="insight-section" aria-labelledby="insight-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THEO DÕI BỔ SUNG</span>
              <h2 id="insight-title">Theo dõi chuyên biệt</h2>
            </div>
            <span className="section-meta">
              Hỗ trợ xử lý ngoại lệ và theo dõi luồng hàng
            </span>
          </div>
          <OverviewInsights
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
      </div>
    </div>
  );
}

import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { useMemo, useState } from "react";
import { Box, UiAlert, UiSelect } from "@/shared/ui";
import {
  ExportOutlined,
  ShopOutlined,
  TeamOutlined,
  SwapOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { LineChart } from "@/shared/components/charts/LineChart";
import { DonutChart } from "@/shared/components/charts/DonutChart";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  CATEGORICAL_PALETTE,
  CHART_COLORS,
} from "@/shared/components/charts/chart-theme";
import {
  RECIPIENT_TYPES,
  recipientTypeLabel,
} from "@/shared/constants/recipient-types";
import {
  axisDayLabel,
  dateSpan,
  dayKey,
  fmt,
  fmtDate,
  listOf,
  n,
  text,
  type ItemKind,
} from "./report-format";
import {
  useAgencyOptions,
  useCategoryOptions,
  useOutboundByRecipient,
  useReversalDocuments,
  useDocumentHistory,
  useSkuCatalog,
  useUserDirectory,
} from "./report-data";
import {
  ChartCard,
  ChartGrid,
  DrillDownDialog,
  FilterBar,
  FormulaNote,
  ReportKpi,
  ReportKpiRow,
  ReportSectionHeading,
  SegmentedToggle,
} from "./report-ui";
import {
  AllOrPickFilter,
  ExportButtons,
  ItemKindFilter,
  PeriodFilterControls,
} from "./report-filters";
import { usePeriodFilter } from "./report-period";
import { MultiSelectFilter, ReportPaginationBar } from "./report-table";
import { useClientPagination } from "./report-columns";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { useReportExport } from "./report-export";

const TOP_OPTIONS = [
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
] as const;

const breakdownOptions = (t: TranslateFn) =>
  [
    { value: "SKU", label: t("reports.recipient.bySku") },
    { value: "CATEGORY", label: t("reports.recipient.byCategory") },
  ] as const;

type IssueRow = {
  key: string;
  documentId: string;
  outboundNo: string;
  documentDate: string;
  recipientId: string;
  recipientName: string;
  recipientType: string;
  market: string;
  region: string;
  skuId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  kind: ItemKind;
  /** Phòng ban xử lý phiếu — suy từ người tạo/ghi nhận qua danh bạ người dùng. */
  departmentId: string;
  gross: number;
  reversal: number;
  net: number;
};

/**
 * Tab 7 — Xuất hàng theo người nhận / đại lý.
 *
 * `Net Issued Qty` không có sẵn ở bất kỳ endpoint nào: `/reports/outbound-by-recipient`
 * chỉ trả lượng đã xuất (gross), còn lượng đã đảo nằm ở `/reversal-documents`
 * và chỉ tham chiếu tới CHỨNG TỪ gốc, không tới từng dòng SKU. Vì vậy lượng đảo
 * của một phiếu được phân bổ về các dòng của chính phiếu đó theo tỉ trọng gross
 * — cách duy nhất giữ được đẳng thức `Σ net = Σ gross − Σ reversal` mà vẫn nói
 * đúng dòng nào bị ảnh hưởng. Công thức này được ghi thẳng dưới bảng 7.5.
 */
export default function TabRecipient() {
  const t = useT();
  const period = usePeriodFilter("this-month");
  const catalog = useSkuCatalog();
  const categories = useCategoryOptions();
  const agencies = useAgencyOptions();
  const users = useUserDirectory();
  const exporter = useReportExport();

  const [recipientType, setRecipientType] = useState("");
  const [market, setMarket] = useState("");
  const [region, setRegion] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [itemKind, setItemKind] = useState<ItemKind>("all");
  const [topMode, setTopMode] = useState<"10" | "20">("10");
  const [breakdownBy, setBreakdownBy] = useState<"SKU" | "CATEGORY">("SKU");

  const outbound = useOutboundByRecipient({
    from: period.from,
    to: period.to,
    recipientType: recipientType || undefined,
    market: market || undefined,
    region: region || undefined,
    enabled: !period.invalid,
  });
  const reversals = useReversalDocuments({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });
  const documents = useDocumentHistory({
    from: period.from,
    to: period.to,
    docType: "outbound",
    enabled: !period.invalid,
  });

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of categories.options)
      map.set(option.value, option.label);
    return map;
  }, [categories.options]);

  /** Số phiếu xuất → lượng đã đảo (POSTED) của chính phiếu đó. */
  const reversalByOutboundNo = useMemo(() => {
    const documentNoById = new Map<string, string>();
    for (const row of listOf(documents.data?.rows)) {
      documentNoById.set(text(row.id, ""), text(row.document_no, ""));
    }
    const map = new Map<string, number>();
    for (const row of listOf(reversals.data?.data)) {
      if (text(row.status, "") !== "POSTED") continue;
      const docNo =
        text(row.reference_document_code, "") ||
        documentNoById.get(text(row.reference_document_id, "")) ||
        "";
      if (!docNo) continue;
      map.set(docNo, (map.get(docNo) ?? 0) + n(row.total_qty));
    }
    return map;
  }, [reversals.data, documents.data]);

  /** Số phiếu xuất → id phòng ban xử lý (suy từ người tạo/ghi nhận phiếu). */
  const departmentByOutboundNo = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of listOf(documents.data?.rows)) {
      const docNo = text(row.document_no, "");
      if (!docNo) continue;
      const actor = text(row.created_by_name ?? row.posted_by_name, "");
      const deptId = users.departmentOfName(actor);
      if (deptId) map.set(docNo, deptId);
    }
    return map;
  }, [documents.data, users]);

  const rows = useMemo<IssueRow[]>(() => {
    const raw = listOf(outbound.data?.rows);
    const linesByDocument = new Map<string, number[]>();
    raw.forEach((row, index) => {
      const docNo = text(row.outbound_no, "");
      const bucket = linesByDocument.get(docNo);
      if (bucket) bucket.push(index);
      else linesByDocument.set(docNo, [index]);
    });

    /**
     * Phân bổ lượng đã đảo của một phiếu về từng dòng SKU theo tỉ trọng gross,
     * làm tròn theo phương pháp "phần dư lớn nhất": số lượng kho luôn là SỐ
     * NGUYÊN, chia tỉ lệ thẳng sẽ ra "22,68 cái" — vừa sai đơn vị vừa làm tổng
     * các dòng lệch tổng phiếu. Làm tròn xuống từng dòng rồi dồn phần còn thiếu
     * vào các dòng có phần thập phân lớn nhất, nhờ đó Σ dòng = lượng đảo của
     * chính phiếu đó.
     */
    const reversalByIndex = new Array<number>(raw.length).fill(0);
    for (const [docNo, indexes] of linesByDocument) {
      const documentReversal = reversalByOutboundNo.get(docNo) ?? 0;
      if (documentReversal <= 0) continue;
      const grossOf = (index: number) =>
        n(raw[index].issued_qty ?? raw[index].scanned_qty);
      const documentGross = indexes.reduce(
        (acc, index) => acc + grossOf(index),
        0,
      );
      if (documentGross <= 0) continue;

      const shares = indexes.map((index) => {
        const exact = (documentReversal * grossOf(index)) / documentGross;
        return { index, floor: Math.floor(exact), rest: exact % 1 };
      });
      let remaining =
        documentReversal - shares.reduce((acc, item) => acc + item.floor, 0);
      shares.sort((a, b) => b.rest - a.rest);
      for (const share of shares) {
        const bonus = remaining > 0 ? 1 : 0;
        remaining -= bonus;
        reversalByIndex[share.index] = share.floor + bonus;
      }
    }

    return raw.map((row, index) => {
      const productCode = text(row.product_code, "");
      const entry = catalog.byCode.get(productCode);
      const outboundNo = text(row.outbound_no, "");
      const gross = n(row.issued_qty ?? row.scanned_qty);
      const reversal = reversalByIndex[index] ?? 0;

      return {
        key: `${outboundNo}-${productCode}-${index}`,
        documentId: text(row.document_id, ""),
        outboundNo,
        documentDate: text(row.document_date, ""),
        recipientId: text(row.recipient_id, ""),
        recipientName: text(row.recipient_name ?? row.agency_name, ""),
        recipientType: text(row.recipient_type, "AGENCY"),
        market: text(row.market, ""),
        region: text(row.region, ""),
        skuId: text(row.sku_id, ""),
        productCode,
        productName: text(row.product_name, entry?.sku_name ?? ""),
        categoryId: entry?.category_id ?? "",
        kind: (entry?.sku_type ?? "all") as ItemKind,
        departmentId: departmentByOutboundNo.get(outboundNo) ?? "",
        gross,
        reversal,
        net: gross - reversal,
      };
    });
  }, [outbound.data, catalog, reversalByOutboundNo, departmentByOutboundNo]);

  /** Bộ lọc dùng chung cho cả 5 biểu đồ và bảng chi tiết. */
  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (recipientType && row.recipientType !== recipientType) return false;
        if (market && row.market !== market) return false;
        if (region && row.region !== region) return false;
        if (
          recipientIds.length > 0 &&
          !recipientIds.includes(row.recipientId)
        ) {
          return false;
        }
        if (categoryId && row.categoryId !== categoryId) return false;
        if (departmentId && row.departmentId !== departmentId) return false;
        if (itemKind !== "all" && row.kind !== itemKind) return false;
        return true;
      }),
    [
      rows,
      recipientType,
      market,
      region,
      recipientIds,
      categoryId,
      departmentId,
      itemKind,
    ],
  );

  // ── 7.1 Top người nhận ─────────────────────────────────────────────────
  const byRecipient = useMemo(() => {
    const map = new Map<
      string,
      { name: string; net: number; gross: number; documents: Set<string> }
    >();
    for (const row of filtered) {
      const key = row.recipientName || t("reports.common.undetermined");
      const current = map.get(key) ?? {
        name: key,
        net: 0,
        gross: 0,
        documents: new Set<string>(),
      };
      current.net += row.net;
      current.gross += row.gross;
      current.documents.add(row.outboundNo);
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.net - a.net);
  }, [filtered, t]);

  const [recipientDrill, setRecipientDrill] = useState<string | null>(null);

  // ── 7.2 Cơ cấu hàng đã xuất theo người nhận ────────────────────────────
  const structure = useMemo(() => {
    const selectedNames =
      recipientIds.length > 0
        ? [...new Set(filtered.map((row) => row.recipientName))]
        : byRecipient.slice(0, Number(topMode)).map((item) => item.name);

    const dimensionOf = (row: IssueRow) =>
      breakdownBy === "SKU"
        ? row.productCode || t("reports.common.undetermined")
        : (categoryNameById.get(row.categoryId) ??
          t("reports.recipient.unclassified"));

    const dimensionTotals = new Map<string, number>();
    for (const row of filtered) {
      if (!selectedNames.includes(row.recipientName)) continue;
      const key = dimensionOf(row);
      dimensionTotals.set(key, (dimensionTotals.get(key) ?? 0) + row.net);
    }
    // Quá nhiều lát thì stacked bar thành một dải màu không đọc được — giữ 8
    // nhóm lớn nhất, phần còn lại gộp thành "Khác" thay vì cắt mất số liệu.
    const ranked = [...dimensionTotals.entries()].sort((a, b) => b[1] - a[1]);
    const keptKeys = ranked.slice(0, 8).map(([key]) => key);
    const hasOther = ranked.length > keptKeys.length;
    const dimensions = hasOther
      ? [...keptKeys, t("reports.common.other")]
      : keptKeys;

    const series = dimensions.map((dimension, index) => ({
      name: dimension,
      color: CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
      data: selectedNames.map((recipient) =>
        filtered
          .filter((row) => {
            if (row.recipientName !== recipient) return false;
            const key = dimensionOf(row);
            return dimension === t("reports.common.other")
              ? !keptKeys.includes(key)
              : key === dimension;
          })
          .reduce((acc, row) => acc + row.net, 0),
      ),
    }));

    return { categories: selectedNames, series };
  }, [
    filtered,
    recipientIds,
    byRecipient,
    topMode,
    breakdownBy,
    categoryNameById,
    t,
  ]);

  // ── 7.3 Xu hướng xuất theo thời gian ───────────────────────────────────
  const days = useMemo(
    () => dateSpan(period.from, period.to),
    [period.from, period.to],
  );

  const trendSeries = useMemo(() => {
    const selectedNames =
      recipientIds.length > 0
        ? [...new Set(filtered.map((row) => row.recipientName))].slice(0, 6)
        : [];

    if (selectedNames.length === 0) {
      const totals = new Map<string, number>(days.map((day) => [day, 0]));
      for (const row of filtered) {
        const day = dayKey(row.documentDate);
        if (totals.has(day)) totals.set(day, (totals.get(day) ?? 0) + row.net);
      }
      return [
        {
          name: t("reports.recipient.seriesTotal"),
          data: days.map((day) => totals.get(day) ?? 0),
          color: CHART_COLORS.primary,
        },
      ];
    }

    return selectedNames.map((recipient, index) => {
      const totals = new Map<string, number>(days.map((day) => [day, 0]));
      for (const row of filtered) {
        if (row.recipientName !== recipient) continue;
        const day = dayKey(row.documentDate);
        if (totals.has(day)) totals.set(day, (totals.get(day) ?? 0) + row.net);
      }
      return {
        name: recipient,
        data: days.map((day) => totals.get(day) ?? 0),
        color: CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
      };
    });
  }, [filtered, recipientIds, days, t]);

  // ── 7.4 Cơ cấu theo loại Recipient ─────────────────────────────────────
  const byRecipientType = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filtered) {
      map.set(row.recipientType, (map.get(row.recipientType) ?? 0) + row.net);
    }
    return RECIPIENT_TYPES.map((type, index) => ({
      label: recipientTypeLabel(type),
      value: map.get(type) ?? 0,
      color: CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
      type,
    }));
  }, [filtered]);

  const [typeDrill, setTypeDrill] = useState<string | null>(null);

  // ── 7.5 Bảng chi tiết ──────────────────────────────────────────────────
  const [keyword, setKeyword] = useState("");

  const detailRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        recipientName: string;
        recipientType: string;
        productCode: string;
        productName: string;
        category: string;
        documents: Set<string>;
        gross: number;
        reversal: number;
        net: number;
        firstDate: string;
        lastDate: string;
      }
    >();
    for (const row of filtered) {
      const key = `${row.recipientName}|${row.productCode}`;
      const current = map.get(key) ?? {
        key,
        recipientName: row.recipientName || t("reports.common.undetermined"),
        recipientType: row.recipientType,
        productCode: row.productCode,
        productName: row.productName,
        category:
          categoryNameById.get(row.categoryId) ??
          t("reports.recipient.unclassified"),
        documents: new Set<string>(),
        gross: 0,
        reversal: 0,
        net: 0,
        firstDate: row.documentDate,
        lastDate: row.documentDate,
      };
      current.documents.add(row.outboundNo);
      current.gross += row.gross;
      current.reversal += row.reversal;
      current.net += row.net;
      if (row.documentDate < current.firstDate) {
        current.firstDate = row.documentDate;
      }
      if (row.documentDate > current.lastDate)
        current.lastDate = row.documentDate;
      map.set(key, current);
    }
    const needle = keyword.trim().toLowerCase();
    return [...map.values()]
      .filter((row) =>
        needle
          ? `${row.recipientName} ${row.productCode} ${row.productName}`
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => b.net - a.net);
  }, [filtered, categoryNameById, keyword, t]);

  const pagination = useClientPagination(detailRows, 15);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => ({
          gross: acc.gross + row.gross,
          reversal: acc.reversal + row.reversal,
          net: acc.net + row.net,
        }),
        { gross: 0, reversal: 0, net: 0 },
      ),
    [filtered],
  );

  const loading = outbound.isLoading || catalog.loading;

  return (
    <Box data-testid="rpt-tab-recipient">
      <ReportSectionHeading
        id="rpt-tab7-heading"
        title={t("reports.recipient.title")}
        description={t("reports.recipient.description")}
      />

      <FilterBar
        label={t("reports.recipient.filterLabel")}
        hint={t("reports.recipient.filterHint", {
          label: period.label,
          count: fmt(byRecipient.length),
        })}
      >
        <PeriodFilterControls state={period} />
        <AllOrPickFilter
          value={recipientType}
          onChange={setRecipientType}
          options={RECIPIENT_TYPES.map((value) => ({
            value,
            label: recipientTypeLabel(value),
          }))}
          allLabel={t("reports.recipient.typeAll")}
          ariaLabel={t("reports.recipient.typeAria")}
          minWidth={210}
        />
        <AllOrPickFilter
          value={market}
          onChange={setMarket}
          options={agencies.marketOptions}
          allLabel={t("reports.recipient.marketAll")}
          ariaLabel={t("reports.recipient.marketAria")}
        />
        <AllOrPickFilter
          value={region}
          onChange={setRegion}
          options={agencies.regionOptions}
          allLabel={t("reports.recipient.regionAll")}
          ariaLabel={t("reports.recipient.regionAria")}
        />
        <MultiSelectFilter
          value={recipientIds}
          onChange={setRecipientIds}
          options={agencies.options}
          placeholder={t("reports.recipient.recipientPlaceholder")}
          ariaLabel={t("reports.recipient.recipientAria")}
          minWidth={240}
        />
        <AllOrPickFilter
          value={categoryId}
          onChange={setCategoryId}
          options={categories.options}
          allLabel={t("reports.recipient.skuAll")}
          ariaLabel={t("reports.recipient.skuAria")}
          minWidth={220}
        />
        <AllOrPickFilter
          value={departmentId}
          onChange={setDepartmentId}
          options={users.departmentOptions}
          allLabel={t("reports.recipient.departmentAll")}
          ariaLabel={t("reports.recipient.departmentAria")}
          minWidth={200}
        />
        <ItemKindFilter value={itemKind} onChange={setItemKind} />
      </FilterBar>

      {period.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">{t("reports.common.dateOrderError")}</UiAlert>
        </Box>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label={t("reports.recipient.kpiRecipients")}
          value={fmt(byRecipient.length)}
          tone="primary"
          icon={<TeamOutlined />}
        />
        <ReportKpi
          label={t("reports.recipient.kpiGross")}
          value={fmt(totals.gross)}
          tone="info"
          icon={<ExportOutlined />}
          hint={t("reports.recipient.kpiGrossHint")}
        />
        <ReportKpi
          label={t("reports.recipient.kpiReversed")}
          value={fmt(totals.reversal)}
          tone="warning"
          icon={<SwapOutlined />}
          hint={t("reports.recipient.kpiReversedHint")}
        />
        <ReportKpi
          label={t("reports.recipient.kpiNet")}
          value={fmt(totals.net)}
          tone="success"
          icon={<ShopOutlined />}
          hint={t("reports.recipient.kpiNetHint")}
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title={t("reports.recipient.topTitle")}
          description={t("reports.recipient.topDescription")}
          loading={loading}
          error={outbound.error}
          onRetry={() => void outbound.refetch()}
          empty={byRecipient.length === 0}
          emptyText={t("reports.recipient.topEmpty")}
          toolbar={
            <SegmentedToggle
              label={t("reports.recipient.topCount")}
              value={topMode}
              onChange={setTopMode}
              options={TOP_OPTIONS}
            />
          }
        >
          <HorizontalBarChart
            items={byRecipient.map((item) => ({
              label: item.name,
              value: item.net,
            }))}
            limit={Number(topMode)}
            color={CHART_COLORS.primary}
            valueFormatter={fmt}
            onSelect={(item) => setRecipientDrill(item.label)}
          />
        </ChartCard>

        <ChartCard
          title={t("reports.recipient.typeMixTitle")}
          description={t("reports.recipient.typeMixDescription")}
          loading={loading}
          error={outbound.error}
          onRetry={() => void outbound.refetch()}
          empty={totals.net === 0}
        >
          <DonutChart
            items={byRecipientType}
            centerLabel={t("reports.recipient.typeMixCenter")}
            valueFormatter={fmt}
            onSelect={(_item, index) =>
              setTypeDrill(byRecipientType[index]?.type ?? null)
            }
          />
        </ChartCard>
      </ChartGrid>

      <ChartCard
        title={t("reports.recipient.breakdownTitle")}
        description={
          recipientIds.length === 0
            ? t("reports.recipient.breakdownTopMode", { mode: topMode })
            : recipientIds.length === 1
              ? t("reports.recipient.breakdownSingle")
              : t("reports.recipient.breakdownMulti")
        }
        fullWidth
        loading={loading}
        error={outbound.error}
        onRetry={() => void outbound.refetch()}
        empty={structure.categories.length === 0}
        toolbar={
          <SegmentedToggle
            label={t("reports.recipient.breakdownDimension")}
            value={breakdownBy}
            onChange={setBreakdownBy}
            options={breakdownOptions(t)}
          />
        }
      >
        <MultiSeriesBarChart
          stacked
          horizontal
          categories={structure.categories}
          series={structure.series}
          valueFormatter={fmt}
          onSelect={(payload) => setRecipientDrill(payload.category)}
        />
      </ChartCard>

      <Box sx={{ height: 16 }} />

      <ChartCard
        title={t("reports.recipient.trendTitle")}
        description={
          recipientIds.length === 0
            ? t("reports.recipient.trendAll")
            : t("reports.recipient.trendSelected")
        }
        fullWidth
        loading={loading}
        error={outbound.error}
        onRetry={() => void outbound.refetch()}
        empty={days.length === 0 || totals.net === 0}
      >
        <LineChart
          categories={days.map(axisDayLabel)}
          series={trendSeries}
          height={320}
          valueFormatter={fmt}
        />
      </ChartCard>

      <Box sx={{ height: 16 }} />

      <ReportSectionHeading
        id="rpt-tab7-detail"
        title={t("reports.recipient.detailTitle")}
        description={t("reports.recipient.detailDescription")}
      />

      <FilterBar
        label={t("reports.recipient.detailFilterLabel")}
        hint={t("reports.recipient.detailFilterHint", {
          count: fmt(detailRows.length),
        })}
        actions={
          <ExportButtons
            exporting={exporter.exporting}
            disabled={period.invalid || loading}
            onExport={(format) =>
              void exporter.exportReport(format, {
                reportCode: "outbound-by-agency",
                fileStem: "xuat-theo-nguoi-nhan",
                fileSuffix: `-${period.from}-${period.to}`,
                filters: {
                  from_date: period.from,
                  to_date: period.to,
                  ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
                },
              })
            }
          />
        }
      >
        <SearchInput
          width={300}
          placeholder={t("reports.recipient.detailSearchPlaceholder")}
          aria-label={t("reports.recipient.detailSearchAria")}
          value={keyword}
          onChange={setKeyword}
        />
        <UiSelect
          minWidth={200}
          aria-label={t("reports.recipient.dimensionAria")}
          value={breakdownBy}
          onChange={(value) => setBreakdownBy(value as "SKU" | "CATEGORY")}
          options={[...breakdownOptions(t)]}
        />
      </FilterBar>

      {outbound.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={outbound.error}
            title={t("reports.recipient.detailLoadError")}
            onRetry={() => void outbound.refetch()}
          />
        </Box>
      ) : null}

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title={t("reports.common.exportDenied")}
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      <ResponsiveDataTable<(typeof detailRows)[number]>
        columns={[
          {
            key: "stt",
            header: "STT",
            align: "center",
            width: 56,
            hideOnMobile: true,
            render: (row) =>
              mvpRowNumber(
                pagination.page,
                pagination.perPage,
                pagination.pageRows.indexOf(row),
              ),
          },
          {
            key: "recipientName",
            header: t("reports.recipient.colRecipient"),
            sortAccessor: (row) => row.recipientName,
            render: (row) => (
              <Box sx={{ fontWeight: 700 }}>{row.recipientName}</Box>
            ),
          },
          {
            key: "recipientType",
            header: t("reports.recipient.colRecipientType"),
            width: 160,
            render: (row) => recipientTypeLabel(row.recipientType),
          },
          {
            key: "productCode",
            header: t("reports.recipient.colSkuCode"),
            width: 150,
            sortAccessor: (row) => row.productCode,
            render: (row) => (
              <Box>
                <Box>{row.productCode || EMPTY_TEXT}</Box>
                <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                  {row.productName}
                </Box>
              </Box>
            ),
          },
          {
            key: "category",
            header: t("reports.recipient.colCategory"),
            width: 170,
            hideOnMobile: true,
            render: (row) => row.category,
          },
          {
            key: "documents",
            header: t("reports.recipient.colDocCount"),
            align: "right",
            width: 110,
            sortAccessor: (row) => row.documents.size,
            render: (row) => fmt(row.documents.size),
          },
          {
            key: "gross",
            header: t("reports.recipient.colGross"),
            align: "right",
            width: 130,
            sortAccessor: (row) => row.gross,
            render: (row) => fmt(row.gross),
          },
          {
            key: "reversal",
            header: t("reports.recipient.colReversed"),
            align: "right",
            width: 120,
            sortAccessor: (row) => row.reversal,
            render: (row) => fmt(row.reversal),
          },
          {
            key: "net",
            header: t("reports.recipient.colNet"),
            align: "right",
            width: 145,
            sortAccessor: (row) => row.net,
            render: (row) => (
              <Box component="span" sx={{ fontWeight: 700 }}>
                {fmt(row.net)}
              </Box>
            ),
          },
          {
            key: "time",
            header: t("reports.recipient.colTime"),
            width: 190,
            hideOnMobile: true,
            render: (row) =>
              row.firstDate === row.lastDate
                ? fmtDate(row.firstDate)
                : `${fmtDate(row.firstDate)} → ${fmtDate(row.lastDate)}`,
          },
        ]}
        rows={pagination.pageRows}
        rowKey={(row) => row.key}
        loading={loading}
        emptyText={t("reports.recipient.detailEmpty")}
      />
      <ReportPaginationBar
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPerPage}
      />
      <FormulaNote>{t("reports.recipient.formulaNote")}</FormulaNote>

      {recipientDrill ? (
        <DrillDownDialog
          title={t("reports.recipient.drillTitle", {
            recipient: recipientDrill,
          })}
          onClose={() => setRecipientDrill(null)}
        >
          <ResponsiveDataTable<IssueRow>
            columns={[
              {
                key: "outboundNo",
                header: t("reports.recipient.colIssueNote"),
                render: (row) => row.outboundNo || EMPTY_TEXT,
              },
              {
                key: "documentDate",
                header: t("reports.recipient.colDate"),
                render: (row) =>
                  row.documentDate ? fmtDate(row.documentDate) : EMPTY_TEXT,
              },
              {
                key: "productCode",
                header: t("reports.recipient.colSkuCode"),
                render: (row) => row.productCode || EMPTY_TEXT,
              },
              {
                key: "productName",
                header: t("reports.recipient.colSkuName"),
                render: (row) => row.productName || EMPTY_TEXT,
              },
              {
                key: "gross",
                header: t("reports.recipient.colGross"),
                align: "right",
                render: (row) => fmt(row.gross),
              },
              {
                key: "reversal",
                header: t("reports.recipient.colReversed"),
                align: "right",
                render: (row) => fmt(row.reversal),
              },
              {
                key: "net",
                header: t("reports.recipient.colNet"),
                align: "right",
                render: (row) => fmt(row.net),
              },
            ]}
            rows={filtered.filter(
              (row) =>
                (row.recipientName || t("reports.common.undetermined")) ===
                recipientDrill,
            )}
            rowKey={(row) => row.key}
            emptyText={t("reports.recipient.drillEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {typeDrill ? (
        <DrillDownDialog
          title={t("reports.recipient.typeDrillTitle", {
            type: recipientTypeLabel(typeDrill),
          })}
          onClose={() => setTypeDrill(null)}
        >
          <ResponsiveDataTable<{ name: string; net: number; gross: number }>
            columns={[
              {
                key: "name",
                header: t("reports.recipient.colName"),
                render: (row) => row.name,
              },
              {
                key: "gross",
                header: t("reports.recipient.colGross"),
                align: "right",
                render: (row) => fmt(row.gross),
              },
              {
                key: "net",
                header: t("reports.recipient.colNet"),
                align: "right",
                render: (row) => fmt(row.net),
              },
            ]}
            rows={(() => {
              const map = new Map<
                string,
                { name: string; net: number; gross: number }
              >();
              for (const row of filtered) {
                if (row.recipientType !== typeDrill) continue;
                const key =
                  row.recipientName || t("reports.common.undetermined");
                const current = map.get(key) ?? { name: key, net: 0, gross: 0 };
                current.net += row.net;
                current.gross += row.gross;
                map.set(key, current);
              }
              return [...map.values()].sort((a, b) => b.net - a.net);
            })()}
            rowKey={(row) => row.name}
            emptyText={t("reports.recipient.typeDrillEmpty")}
          />
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}

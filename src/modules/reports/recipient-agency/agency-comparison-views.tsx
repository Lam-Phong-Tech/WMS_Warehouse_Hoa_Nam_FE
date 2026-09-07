/**
 * Các khối dựng nên tab "So sánh đối tượng nhận hàng".
 *
 * Tách khỏi `AgencyComparisonTab.tsx` để file điều phối còn đọc được: ở đó chỉ
 * còn state + thứ tự các mục (KPI → Nhận xét → So sánh → Xu hướng → Nhanh/Chậm
 * → Ma trận → Xếp hạng → Chi tiết), còn hình khối nằm hết ở đây.
 *
 * Mọi khối đều nhận chuỗi ĐÃ DỊCH từ nơi gọi hoặc tự gọi `useT` — không có
 * chuỗi tiếng Việt cứng nào trong file này.
 */
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  Box,
  Menu,
  Stack,
  Tooltip,
  UiButton,
  UiOptionPicker,
  UiStatusBadge,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui";
import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
} from "@/shared/components/icons";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import {
  SURFACE_SX,
  formatInsightValues,
  quantityText,
} from "./agency-comparison-format";
import {
  RPT_CONTROL_MOTION_SX,
  RPT_SURFACE_MOTION_SX,
} from "@/modules/reports/operations/report-tokens";
import type { ComparisonOption } from "./agency-comparison-api";
import type {
  ComparisonInsight,
  ComparisonInsightKind,
  ComparisonParty,
  ComparisonSku,
} from "./agency-comparison-model";

// ── Bộ chọn nhiều giá trị có tìm kiếm ────────────────────────────────────

/**
 * Multi-select "chọn để so sánh".
 *
 * Phần bên trong tấm thả xuống (ô tìm, danh sách 5 dòng, chọn tất cả / bỏ
 * chọn, trần lựa chọn) nay là `UiOptionPicker` dùng chung với các màn báo cáo
 * khác. Cái CÒN LẠI ở đây, và là lý do màn này không dùng thẳng
 * `MultiSelectFilter`: chip của những gì đang chọn nằm NGAY DƯỚI nút — trong
 * một màn so sánh, "đang so sánh chính xác những ai" là thông tin quan trọng
 * hơn cả, không thể rút gọn thành "đã chọn N".
 */
export function ComparisonPicker({
  label,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  maxSelectable,
  searchable,
  showQty = false,
}: {
  label: string;
  options: ComparisonOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Trần số lựa chọn — vượt trần thì các ô còn lại bị khoá, kèm giải thích. */
  maxSelectable?: number;
  /**
   * Ép có/không ô tìm. Bỏ trống = tự quyết theo số option. Danh mục LUÔN dài
   * (đại lý, SKU) nên ép `true` để ô tìm không nhảy ra/vào theo kỳ đang xem;
   * bộ lọc phạm vi (loại, thị trường, khu vực) thì để tự.
   */
  searchable?: boolean;
  showQty?: boolean;
}) {
  const t = useT();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selected = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  );
  // Sản lượng đi kèm mỗi dòng giúp người dùng biết chọn ai thì mới có số để so.
  const pickerOptions = useMemo(
    () =>
      options.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.hint,
        meta: showQty ? quantityText(option.qty ?? 0) : undefined,
      })),
    [options, showQty],
  );

  const summary =
    selected.length === 0
      ? placeholder
      : t("reports.agencyComparison.pickerSelected", {
          count: selected.length,
        });

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        sx={{
          mb: 0.65,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: "18px",
          color: S.textMedium,
        }}
      >
        {label}
      </Box>
      <UiButton
        appearance="outlined"
        color="secondary"
        aria-label={label}
        aria-haspopup="listbox"
        endIcon={<DownOutlined style={{ fontSize: 12 }} />}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          width: "100%",
          justifyContent: "space-between",
          fontWeight: 400,
          textAlign: "left",
          color: selected.length === 0 ? S.textDisabled : S.textHigh,
        }}
      >
        {summary}
      </UiButton>

      {selected.length > 0 ? (
        <Stack
          direction="row"
          sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.5 }}
          role="list"
          aria-label={t("reports.agencyComparison.pickerChipsAria", { label })}
        >
          {selected.map((option) => (
            <Box
              key={option.value}
              role="listitem"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                maxWidth: "100%",
                pl: 1,
                pr: 0.25,
                py: 0.25,
                borderRadius: 999,
                bgcolor: S.primarySoft,
                color: S.primaryDark,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              <Box
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={option.label}
              >
                {option.label}
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={t("reports.agencyComparison.pickerRemove", {
                  name: option.label,
                })}
                onClick={() =>
                  onChange(value.filter((item) => item !== option.value))
                }
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 18,
                  height: 18,
                  flex: "none",
                  border: 0,
                  borderRadius: "50%",
                  bgcolor: "transparent",
                  color: "inherit",
                  fontSize: 9,
                  cursor: "pointer",
                  ...RPT_CONTROL_MOTION_SX,
                  "&:hover": { bgcolor: S.primary, color: S.onPrimary },
                }}
              >
                <CloseOutlined />
              </Box>
            </Box>
          ))}
        </Stack>
      ) : null}

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { width: 340, maxWidth: "92vw" } } }}
      >
        <UiOptionPicker
          options={pickerOptions}
          value={value}
          onChange={onChange}
          aria-label={label}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          maxSelectable={maxSelectable}
          quickActions
          searchable={searchable}
        />
      </Menu>
    </Box>
  );
}

// ── KPI ──────────────────────────────────────────────────────────────────

const KPI_TONES = {
  primary: { accent: S.primary, surface: S.primarySoft, text: S.primaryDark },
  success: { accent: S.success, surface: S.successSoft, text: S.successText },
  warning: { accent: S.warning, surface: S.warningSoft, text: S.warningText },
  info: { accent: S.info, surface: S.infoSoft, text: S.infoText },
  neutral: {
    accent: S.secondary,
    surface: S.secondarySoft,
    text: S.secondaryDark,
  },
} as const;

export type ComparisonKpiTone = keyof typeof KPI_TONES;

export function ComparisonKpiCard({
  label,
  value,
  hint,
  icon,
  tone,
  badge,
  badgeTone,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: ReactElement;
  tone: ComparisonKpiTone;
  badge?: string;
  badgeTone?: "success" | "error" | "neutral" | "warning";
}) {
  const style = KPI_TONES[tone];
  return (
    <Box
      sx={{
        ...SURFACE_SX,
        p: { xs: 1.5, md: 1.75 },
        minHeight: 132,
        display: "flex",
        flexDirection: "column",
        backgroundImage: `linear-gradient(145deg, ${S.bgSurface} 34%, ${style.surface})`,
        borderTop: `2px solid ${style.accent}`,
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Box
          sx={{
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            fontWeight: 700,
            letterSpacing: "0.025em",
            textTransform: "uppercase",
            color: S.textHigh,
          }}
        >
          {label}
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: 32,
            height: 32,
            flex: "none",
            display: "grid",
            placeItems: "center",
            borderRadius: `${RADIUS.control}px`,
            bgcolor: style.surface,
            color: style.text,
            fontSize: 15,
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Box
        sx={{
          mt: 1,
          fontSize: "clamp(20px, 1.9vw, 26px)",
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: S.textHigh,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </Box>
      <Stack
        direction="row"
        sx={{
          mt: "auto",
          pt: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ fontSize: 11.5, color: S.textMedium, minWidth: 0 }}>
          {hint}
        </Box>
        {badge ? (
          <UiStatusBadge
            size="small"
            tone={
              badgeTone === "success"
                ? "success"
                : badgeTone === "error"
                  ? "error"
                  : badgeTone === "warning"
                    ? "warning"
                    : "neutral"
            }
            label={badge}
          />
        ) : null}
      </Stack>
    </Box>
  );
}

// ── Nhận xét tự động ─────────────────────────────────────────────────────

const INSIGHT_STYLES: Record<
  ComparisonInsightKind,
  { accent: string; surface: string; text: string; labelKey: string }
> = {
  highlight: {
    accent: S.primary,
    surface: S.primarySoft,
    text: S.primaryDark,
    labelKey: "reports.agencyComparison.insightKindHighlight",
  },
  growth: {
    accent: S.success,
    surface: S.successSoft,
    text: S.successText,
    labelKey: "reports.agencyComparison.insightKindGrowth",
  },
  decline: {
    accent: S.error,
    surface: S.errorSoft,
    text: S.errorText,
    labelKey: "reports.agencyComparison.insightKindDecline",
  },
  slow: {
    accent: S.warning,
    surface: S.warningSoft,
    text: S.warningText,
    labelKey: "reports.agencyComparison.insightKindSlow",
  },
  anomaly: {
    accent: S.info,
    surface: S.infoSoft,
    text: S.infoText,
    labelKey: "reports.agencyComparison.insightKindAnomaly",
  },
  data: {
    accent: S.secondary,
    surface: S.secondarySoft,
    text: S.secondaryDark,
    labelKey: "reports.agencyComparison.insightKindData",
  },
};

export function InsightList({
  insights,
  emptyText,
}: {
  insights: ComparisonInsight[];
  emptyText: string;
}) {
  const t = useT();
  if (insights.length === 0) {
    return (
      <Box
        sx={{
          px: 2,
          py: 3,
          textAlign: "center",
          color: S.textMedium,
          fontSize: TYPOGRAPHY.fontSizeSecondary,
        }}
      >
        {emptyText}
      </Box>
    );
  }
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      {insights.map((insight) => {
        const style = INSIGHT_STYLES[insight.kind];
        return (
          <Box
            component="li"
            key={insight.id}
            data-insight-kind={insight.kind}
            sx={{
              display: "flex",
              gap: 1.25,
              p: 1.25,
              borderRadius: `${RADIUS.control}px`,
              border: `1px solid ${S.border}`,
              borderLeft: `3px solid ${style.accent}`,
              bgcolor: S.bgSurface,
              ...RPT_SURFACE_MOTION_SX,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  display: "inline-block",
                  mb: 0.5,
                  px: 0.75,
                  py: 0.125,
                  borderRadius: 999,
                  bgcolor: style.surface,
                  color: style.text,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {t(style.labelKey as Parameters<typeof t>[0])}
              </Box>
              <Box
                sx={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: S.textHigh,
                }}
              >
                {t(insight.messageKey, formatInsightValues(insight.values))}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Ma trận / Heatmap ────────────────────────────────────────────────────

/**
 * Heatmap SKU × đối tượng dựng bằng CSS grid, KHÔNG dùng heatmap của thư viện
 * chart.
 *
 * Hai lý do: (1) thang màu của Apex nhận màu tuyệt đối nên không đi qua token
 * và sẽ lệch giữa hai chế độ sáng/tối; (2) ô ở đây cần vừa là ô đọc số vừa là
 * nút bấm drill-down, còn heatmap của thư viện chỉ phát toạ độ.
 *
 * Độ đậm dựng bằng LỚP PHỦ có `opacity` chứ không trộn màu bằng tay: chữ nằm
 * trên lớp phủ nên luôn giữ nguyên độ tương phản, và không sinh literal màu mới
 * (guard `ui:tokens` chặn hex mới ngoài thư mục token).
 */
export function ComparisonHeatmap({
  skus,
  parties,
  onSelect,
  rowLabel,
  totalLabel,
  topLabel,
}: {
  skus: ComparisonSku[];
  parties: ComparisonParty[];
  onSelect: (sku: ComparisonSku, party: ComparisonParty) => void;
  rowLabel: string;
  totalLabel: string;
  topLabel: string;
}) {
  const t = useT();
  const peak = useMemo(
    () =>
      skus.reduce(
        (max, sku) =>
          Math.max(max, ...sku.byParty.map((qty) => Math.max(0, qty))),
        0,
      ),
    [skus],
  );

  const columns = `minmax(160px, 1.6fr) repeat(${parties.length}, minmax(78px, 1fr)) minmax(86px, 0.9fr) minmax(120px, 1.1fr)`;

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box
        role="table"
        aria-label={t("reports.agencyComparison.heatmapAria")}
        sx={{ minWidth: 620, display: "grid", gap: 0.5 }}
      >
        <Box
          role="row"
          sx={{
            display: "grid",
            gridTemplateColumns: columns,
            gap: 0.5,
            position: "sticky",
            top: 0,
            zIndex: 1,
            bgcolor: S.bgSurface,
          }}
        >
          <Box role="columnheader" sx={headerCellSx}>
            {rowLabel}
          </Box>
          {parties.map((party) => (
            <Box
              key={party.id}
              role="columnheader"
              sx={{ ...headerCellSx, textAlign: "center" }}
              title={party.name}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 8,
                  height: 8,
                  mr: 0.5,
                  display: "inline-block",
                  borderRadius: "50%",
                  bgcolor: party.color,
                }}
              />
              {party.name}
            </Box>
          ))}
          <Box role="columnheader" sx={{ ...headerCellSx, textAlign: "right" }}>
            {totalLabel}
          </Box>
          <Box role="columnheader" sx={headerCellSx}>
            {topLabel}
          </Box>
        </Box>

        {skus.map((sku) => {
          const topParty = parties.find((party) => party.id === sku.topPartyId);
          return (
            <Box
              key={sku.id}
              role="row"
              sx={{
                display: "grid",
                gridTemplateColumns: columns,
                gap: 0.5,
                alignItems: "stretch",
              }}
            >
              <Box role="cell" sx={{ ...bodyCellSx, minWidth: 0 }}>
                <Box
                  sx={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={`${sku.code} · ${sku.name}`}
                >
                  {sku.code || EMPTY_TEXT}
                </Box>
                <Box
                  sx={{
                    fontSize: 11,
                    color: S.textMedium,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {sku.name || EMPTY_TEXT}
                </Box>
              </Box>

              {parties.map((party, at) => {
                const qty = sku.byParty[at] ?? 0;
                const intensity = peak > 0 ? Math.max(0, qty) / peak : 0;
                const strong = intensity >= 0.55;
                const isRowMax = qty > 0 && sku.topPartyId === party.id;
                /*
                 * Ô heatmap chỉ hiện MỘT con số, nên tên trợ năng của nó mặc
                 * định là "150" — vô nghĩa với người đọc màn hình, và cũng
                 * không phân biệt được hai ô cùng giá trị. Đặt nhãn đầy đủ
                 * (dùng lại đúng câu của tooltip) để cả chuột lẫn bàn phím đọc
                 * được cùng một thứ.
                 */
                const cellLabel = t(
                  "reports.agencyComparison.heatmapCellTooltip",
                  {
                    party: party.name,
                    sku: sku.code || sku.name,
                    qty: quantityText(qty),
                    share:
                      sku.qty > 0
                        ? Math.round((Math.max(0, qty) / sku.qty) * 100)
                        : 0,
                  },
                );
                return (
                  /*
                   * Ô = `div[role="cell"]` BỌC một `<button>` thật, chứ không
                   * phải một `<button role="cell">`. Đặt `role="cell"` thẳng
                   * lên nút sẽ GHI ĐÈ vai trò button: trình đọc màn hình không
                   * còn nhận ra đây là thứ bấm được, dù chuột vẫn bấm được.
                   */
                  <Box key={party.id} role="cell" sx={{ minWidth: 0 }}>
                    <Tooltip title={cellLabel}>
                      <Box
                        component="button"
                        type="button"
                        aria-label={cellLabel}
                        onClick={() => onSelect(sku, party)}
                        sx={{
                          position: "relative",
                          overflow: "hidden",
                          display: "grid",
                          placeItems: "center",
                          width: "100%",
                          minHeight: 40,
                          px: 0.5,
                          border: isRowMax
                            ? `1.5px solid ${S.primary}`
                            : `1px solid ${S.border}`,
                          borderRadius: `${RADIUS.control}px`,
                          bgcolor: S.bgSurface,
                          font: "inherit",
                          cursor: "pointer",
                          ...RPT_CONTROL_MOTION_SX,
                          "&:focus-visible": {
                            outline: `2px solid ${S.primary}`,
                            outlineOffset: 1,
                          },
                        }}
                      >
                        <Box
                          aria-hidden="true"
                          sx={{
                            position: "absolute",
                            inset: 0,
                            bgcolor: S.primary,
                            opacity: intensity * 0.85,
                          }}
                        />
                        <Box
                          sx={{
                            position: "relative",
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: strong ? S.onPrimary : S.textHigh,
                          }}
                        >
                          {qty === 0 ? EMPTY_TEXT : quantityText(qty)}
                        </Box>
                      </Box>
                    </Tooltip>
                  </Box>
                );
              })}

              <Box
                role="cell"
                sx={{
                  ...bodyCellSx,
                  justifyContent: "center",
                  textAlign: "right",
                  fontWeight: 700,
                  fontSize: 12.5,
                }}
              >
                {quantityText(sku.qty)}
              </Box>
              <Box
                role="cell"
                sx={{ ...bodyCellSx, justifyContent: "center", minWidth: 0 }}
              >
                {topParty ? (
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", gap: 0.5, minWidth: 0 }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 8,
                        height: 8,
                        flex: "none",
                        borderRadius: "50%",
                        bgcolor: topParty.color,
                      }}
                    />
                    <Box
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={topParty.name}
                    >
                      {topParty.name}
                    </Box>
                  </Stack>
                ) : (
                  <Box sx={{ fontSize: 12, color: S.textMedium }}>
                    {EMPTY_TEXT}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

const headerCellSx = {
  px: 1,
  py: 0.75,
  fontSize: 11.5,
  fontWeight: 700,
  color: S.textMedium,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  borderBottom: `1px solid ${S.border}`,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const bodyCellSx = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  px: 1,
  py: 0.5,
  borderRadius: `${RADIUS.control}px`,
  bgcolor: S.bgSubtle,
} as const;

// ── Khối mục ─────────────────────────────────────────────────────────────

/**
 * Khung chuẩn của một mục báo cáo: tiêu đề + phụ đề + phạm vi thời gian +
 * chỗ đặt control riêng của mục, và ba trạng thái đang tải / rỗng / lỗi.
 *
 * Mọi mục trên tab dùng chung khối này để nhịp thị giác không lệch — đúng
 * nguyên tắc "chart nào cũng phải có title, subtitle và time scope rõ ràng".
 */
export function SectionCard({
  id,
  title,
  subtitle,
  scope,
  icon,
  actions,
  loading,
  empty,
  emptyText,
  children,
  minHeight,
}: {
  id: string;
  title: string;
  subtitle: string;
  scope?: string;
  icon: ReactElement;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText: string;
  children: ReactNode;
  minHeight?: number;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={`${id}-title`}
      sx={{ ...SURFACE_SX, p: { xs: 1.75, md: 2.25 } }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          alignItems: { xs: "stretch", md: "flex-start" },
          justifyContent: "space-between",
          gap: 1.5,
          mb: 1.75,
        }}
      >
        <Stack direction="row" sx={{ gap: 1.25, minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 32,
              height: 32,
              flex: "none",
              display: "grid",
              placeItems: "center",
              borderRadius: `${RADIUS.control}px`,
              bgcolor: S.primarySoft,
              color: S.primaryDark,
              fontSize: 15,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box
              id={`${id}-title`}
              sx={{
                fontSize: TYPOGRAPHY.cardTitle.fontSize,
                fontWeight: 700,
                lineHeight: 1.3,
                color: S.textHigh,
              }}
            >
              {title}
            </Box>
            <Box
              sx={{
                mt: 0.25,
                fontSize: 12,
                lineHeight: 1.45,
                color: S.textMedium,
              }}
            >
              {subtitle}
            </Box>
            {scope ? (
              <Box
                sx={{
                  mt: 0.5,
                  display: "inline-block",
                  px: 0.75,
                  py: 0.125,
                  borderRadius: 999,
                  bgcolor: S.bgSubtle,
                  color: S.textMedium,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {scope}
              </Box>
            ) : null}
          </Box>
        </Stack>
        {actions ? (
          <Stack
            direction="row"
            sx={{ gap: 0.75, flexWrap: "wrap", alignItems: "center" }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>

      {loading ? (
        <Box
          sx={{
            minHeight: minHeight ?? 220,
            display: "grid",
            placeItems: "center",
          }}
        >
          <SectionSkeleton />
        </Box>
      ) : empty ? (
        <Box
          sx={{
            minHeight: minHeight ?? 220,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            px: 3,
            color: S.textMedium,
            fontSize: TYPOGRAPHY.fontSizeSecondary,
          }}
        >
          {emptyText}
        </Box>
      ) : (
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      )}
    </Box>
  );
}

/** Khung xám nhịp nhẹ thay cho spinner — giữ đúng chiều cao khối khi đang tải. */
function SectionSkeleton() {
  return (
    <Box
      aria-hidden="true"
      sx={{ width: "100%", display: "grid", gap: 1, px: 1 }}
    >
      {[86, 72, 58, 44].map((width) => (
        <Box
          key={width}
          sx={{
            height: 14,
            width: `${width}%`,
            borderRadius: 999,
            bgcolor: S.bgSubtle,
          }}
        />
      ))}
    </Box>
  );
}

/** Nút chọn nhỏ dùng cho các bộ chuyển chế độ trong từng mục. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; icon?: ReactElement }>;
  ariaLabel: string;
}) {
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      sx={{
        p: 0.375,
        display: "inline-flex",
        gap: 0.375,
        borderRadius: `${RADIUS.control}px`,
        bgcolor: S.bgSubtle,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Box
            key={option.value}
            component="button"
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              height: 30,
              px: 1.25,
              border: 0,
              borderRadius: `${RADIUS.control}px`,
              bgcolor: active ? S.bgSurface : "transparent",
              color: active ? S.primaryDark : S.textMedium,
              boxShadow: active ? S.shadowCard : "none",
              font: "inherit",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              ...RPT_CONTROL_MOTION_SX,
              "&:hover": { color: S.primaryDark },
              "&:focus-visible": {
                outline: `2px solid ${S.primary}`,
                outlineOffset: 1,
              },
            }}
          >
            {option.icon ? (
              <Box aria-hidden="true" sx={{ fontSize: 12 }}>
                {option.icon}
              </Box>
            ) : null}
            {option.label}
          </Box>
        );
      })}
    </Box>
  );
}

/** Mũi tên xu hướng — đọc được cả khi in đen trắng nhờ ký tự, không chỉ màu. */
export function TrendArrow({
  direction,
}: {
  direction: ComparisonParty["trendDirection"];
}) {
  const t = useT();
  const style =
    direction === "up"
      ? {
          glyph: "▲",
          color: S.successText,
          key: "reports.agencyComparison.trendUp",
        }
      : direction === "down"
        ? {
            glyph: "▼",
            color: S.errorText,
            key: "reports.agencyComparison.trendDown",
          }
        : direction === "flat"
          ? {
              glyph: "—",
              color: S.textMedium,
              key: "reports.agencyComparison.trendFlat",
            }
          : {
              glyph: EMPTY_TEXT,
              color: S.textDisabled,
              key: "reports.agencyComparison.trendUnknown",
            };
  return (
    <Box
      component="span"
      title={t(style.key as Parameters<typeof t>[0])}
      sx={{ color: style.color, fontWeight: 700 }}
    >
      {style.glyph}
    </Box>
  );
}

/** Chấm màu định danh một đối tượng — cùng màu ở mọi chart/bảng của tab. */
export function PartyDot({ color }: { color: string }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 10,
        height: 10,
        flex: "none",
        borderRadius: "50%",
        bgcolor: color,
      }}
    />
  );
}

/** Dấu tích nhỏ dùng trong chú giải "kỳ tương đương". */
export function ComparableMark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Box
      component="span"
      title={label}
      aria-label={label}
      sx={{
        display: "inline-grid",
        placeItems: "center",
        width: 16,
        height: 16,
        borderRadius: "50%",
        bgcolor: ok ? S.successSoft : S.warningSoft,
        color: ok ? S.successText : S.warningText,
        fontSize: 8,
      }}
    >
      {ok ? <CheckOutlined /> : "!"}
    </Box>
  );
}

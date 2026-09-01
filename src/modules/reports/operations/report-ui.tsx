import { useT } from "@/shared/i18n/useT";
import type { ReactElement, ReactNode } from "react";
import {
  Box,
  Stack,
  UiAlert,
  UiButton,
  UiDialog,
  UiSpinner,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { RPT_CAPTION_SX, RPT_CARD_SX, RPT_TITLE_SX } from "./report-tokens";

/** Nhóm nút chọn (kỳ / chiều xem / Top N) — một kiểu toggle duy nhất cho trang. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      role="group"
      aria-label={label}
      sx={{ flexWrap: "wrap", rowGap: 1, minWidth: 0, maxWidth: "100%" }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <UiButton
            key={option.value}
            size="small"
            appearance={active ? "filled" : "outlined"}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </UiButton>
        );
      })}
    </Stack>
  );
}

/**
 * Tiêu đề một mục báo cáo + mô tả nghiệp vụ một dòng.
 *
 * KHÔNG hiển thị số hiệu mục ("1.1", "2.3"…): đó là cách đánh số của tài liệu
 * nghiệp vụ, người dùng cuối không đọc tài liệu đó nên con số chỉ là nhiễu đứng
 * trước tên biểu đồ. Việc đối chiếu spec giữ ở comment trong source.
 */
export function ReportSectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 1.5,
        mb: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box component="h3" id={id} sx={RPT_TITLE_SX}>
          {title}
        </Box>
        {description ? (
          <Box sx={{ ...RPT_CAPTION_SX, mt: 0.5 }}>{description}</Box>
        ) : null}
      </Box>
      {action}
    </Stack>
  );
}

export type ChartCardProps = {
  title: string;
  description?: ReactNode;
  /** Bộ chọn riêng của chart (toggle Top N, Sản phẩm/Linh kiện...). */
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Chiếm trọn bề rộng lưới. */
  fullWidth?: boolean;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** true = không có dữ liệu để vẽ; hiện empty-state thay vì canvas rỗng. */
  empty?: boolean;
  emptyText?: string;
};

/**
 * Card bọc một biểu đồ. Ba trạng thái đang tải / lỗi / rỗng được xử lý NGAY
 * TRONG card: ApexCharts vẽ một canvas trống trơn khi series rỗng, nhìn không
 * khác gì chart đã tải xong và thật sự bằng 0 — người đọc không có cách nào
 * phân biệt "chưa có dữ liệu" với "kỳ này không phát sinh".
 */
export function ChartCard({
  title,
  description,
  toolbar,
  children,
  footer,
  fullWidth,
  loading,
  error,
  onRetry,
  empty,
  emptyText,
}: ChartCardProps) {
  const t = useT();
  const resolvedEmptyText = emptyText ?? t("reports.common.noData");
  // Tiêu đề là duy nhất trong một tab, và chỉ một tab được mount tại một
  // thời điểm — đủ để làm id neo cho aria-labelledby.
  const titleId = `rpt-chart-${title}`
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .toLowerCase();

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ ...RPT_CARD_SX, ...(fullWidth ? { gridColumn: "1 / -1" } : null) }}
    >
      <ReportSectionHeading
        id={titleId}
        title={title}
        description={description}
        action={toolbar}
      />
      {error ? (
        <ApiErrorAlert
          error={error}
          title={t("reports.common.loadError", { title })}
          onRetry={onRetry}
        />
      ) : loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 220 }}>
          <UiSpinner />
        </Box>
      ) : empty ? (
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            minHeight: 200,
            textAlign: "center",
            px: 2,
            color: S.textMedium,
            fontSize: TYPOGRAPHY.fontSizeSecondary,
          }}
        >
          {resolvedEmptyText}
        </Box>
      ) : (
        children
      )}
      {footer}
    </Box>
  );
}

/** Lưới chart 2 cột — tự về 1 cột khi hẹp. */
export function ChartGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        mb: 2,
      }}
    >
      {children}
    </Box>
  );
}

export type ReportKpiTone =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

const KPI_TONE: Record<ReportKpiTone, { color: string; soft: string }> = {
  primary: { color: S.primaryDark, soft: S.primarySoft },
  success: { color: S.successText, soft: S.successSoft },
  warning: { color: S.warningText, soft: S.warningSoft },
  error: { color: S.errorText, soft: S.errorSoft },
  info: { color: S.infoText, soft: S.infoSoft },
  neutral: { color: S.secondaryDark, soft: S.secondarySoft },
};

/**
 * Ô KPI. `onClick` biến ô thành nút thật (không phải div bắt sự kiện) để bàn
 * phím và trình đọc màn hình dùng được cùng đường dẫn drill-down như chuột.
 */
export function ReportKpi({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactElement;
  tone?: ReportKpiTone;
  onClick?: () => void;
}) {
  const toneStyle = KPI_TONE[tone];
  return (
    <Box
      component={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      sx={{
        ...RPT_CARD_SX,
        display: "grid",
        gap: 0.5,
        textAlign: "left",
        font: "inherit",
        cursor: onClick ? "pointer" : "default",
        width: "100%",
        "&:hover": onClick
          ? { borderColor: S.primary, boxShadow: `0 0 0 1px ${S.primary}` }
          : undefined,
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
            color: S.textHigh,
          }}
        >
          {label}
        </Box>
        {icon ? (
          <Box
            aria-hidden="true"
            sx={{
              width: 32,
              height: 32,
              flex: "none",
              borderRadius: `${RADIUS.card}px`,
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              color: toneStyle.color,
              bgcolor: toneStyle.soft,
            }}
          >
            {icon}
          </Box>
        ) : null}
      </Stack>
      <Box
        sx={{
          fontSize: "clamp(20px, 2.2vw, 28px)",
          fontWeight: 700,
          lineHeight: 1.15,
          color: S.textHigh,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Box>
      {hint ? <Box sx={RPT_CAPTION_SX}>{hint}</Box> : null}
    </Box>
  );
}

export function ReportKpiRow({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        mb: 2,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Thanh bộ lọc. Nhóm theo nhãn (vd "Áp dụng cho 3 biểu đồ dưới") để người dùng
 * biết bộ lọc nào ăn vào phần nào — trang này có tới ba tầng bộ lọc (chung cho
 * chart, riêng cho bảng, riêng cho từng chart) nên không dán nhãn là nguồn hiểu
 * nhầm số liệu.
 */
export function FilterBar({
  label,
  hint,
  children,
  actions,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box sx={{ ...RPT_CARD_SX, mb: 2 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 1,
          mb: 1.25,
        }}
      >
        <Box
          sx={{
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            fontWeight: 700,
            color: S.textHigh,
          }}
        >
          {label}
        </Box>
        {hint ? <Box sx={RPT_CAPTION_SX}>{hint}</Box> : null}
      </Stack>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.25,
        }}
      >
        {children}
        {actions ? (
          <>
            <Box sx={{ flex: 1, minWidth: 0 }} />
            {actions}
          </>
        ) : null}
      </Box>
    </Box>
  );
}

/** Hộp thoại drill-down dùng chung: bấm vào chart/KPI → xem danh sách nguồn. */
export function DrillDownDialog({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "lg",
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}) {
  const dialog = useDialogExit(onClose);
  return (
    <UiDialog
      {...dialog.dialogProps}
      maxWidth={maxWidth}
      fullWidth
      title={
        <Box sx={{ position: "relative", pr: 6 }}>
          {title}
          {subtitle ? (
            <Box sx={{ ...RPT_CAPTION_SX, mt: 0.25, fontWeight: 400 }}>
              {subtitle}
            </Box>
          ) : null}
          <ActionIconButton
            kind="close"
            onClick={dialog.close}
            sx={{ position: "absolute", right: -8, top: -4 }}
          />
        </Box>
      }
    >
      {children}
    </UiDialog>
  );
}

/** Ghi chú "số liệu này lấy ở đâu / công thức nào" — đặt dưới chart hoặc bảng. */
export function FormulaNote({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <Box sx={{ ...RPT_CAPTION_SX, mt: 1 }}>
      <Box component="span" sx={{ fontWeight: 700 }}>
        {t("reports.common.formula")}{" "}
      </Box>
      {children}
    </Box>
  );
}

/** Cảnh báo dữ liệu chưa đủ để dựng một mục — nói rõ thiếu gì, không im lặng. */
export function DataGapNotice({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <UiAlert tone="info">{children}</UiAlert>
    </Box>
  );
}

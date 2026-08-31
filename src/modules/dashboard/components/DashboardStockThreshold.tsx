import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import { WarningOutlined, StockOutlined } from "@/shared/components/icons";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { ROUTES } from "@/shared/constants/routes";
import { EMPTY_TEXT } from "@/shared/constants/display";
import type { DashboardOverview } from "../types";
import {
  CARD_SX,
  CAPTION_SX,
  SECTION_TITLE_SX,
  formatNumber,
} from "./dashboard-styles";

/**
 * Yêu cầu vận hành mục 1: "tồn dưới định mức" và "tồn vượt định mức".
 *
 * Số liệu đến từ BE (GET /reports/dashboard-overview → `stock_threshold`), tính
 * trên min_stock/max_stock đã đặt ở SKU master. FE KHÔNG tự suy từ danh sách
 * tồn phía client (một aggregate toàn kho, phải để BE làm). Khi BE chưa phát
 * hành field, khối này hiện placeholder giải thích thay vì con số suy đoán.
 */
function ThresholdCard({
  label,
  value,
  note,
  icon,
  color,
  softColor,
  onClick,
}: {
  label: string;
  value: number | null;
  note: string;
  icon: ReactElement;
  color: string;
  softColor: string;
  onClick?: () => void;
}) {
  const interactive = value != null && value > 0 && onClick;
  return (
    <Box
      component={interactive ? "button" : "div"}
      onClick={interactive ? onClick : undefined}
      sx={{
        ...CARD_SX,
        minWidth: 0,
        display: "grid",
        gap: 0.75,
        textAlign: "left",
        font: "inherit",
        border: `1px solid ${S.border}`,
        cursor: interactive ? "pointer" : "default",
        transition: "border-color .15s ease, box-shadow .15s ease",
        "&:hover": interactive ? { borderColor: color, boxShadow: S.focusRing } : undefined,
        "&:focus-visible": interactive
          ? { outline: "none", boxShadow: S.focusRing }
          : undefined,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: `${RADIUS.card}px`,
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          color,
          bgcolor: softColor,
        }}
        aria-hidden="true"
      >
        {icon}
      </Box>
      <Box
        sx={{
          fontSize: TYPOGRAPHY.fontSizeSecondary,
          fontWeight: 700,
          color: S.textHigh,
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          fontSize: "clamp(22px, 2.5vw, 30px)",
          fontWeight: 700,
          color: S.textHigh,
          overflowWrap: "anywhere",
        }}
      >
        {value != null ? formatNumber(value) : EMPTY_TEXT}
      </Box>
      <Box sx={CAPTION_SX}>{note}</Box>
    </Box>
  );
}

export function DashboardStockThreshold({ data }: { data: DashboardOverview }) {
  const navigate = useNavigate();
  const threshold = data.stock_threshold;
  const available = threshold != null;

  const configuredNote = available
    ? threshold.configured != null
      ? `Trên tổng ${formatNumber(threshold.configured)} SKU đã đặt định mức`
      : "So với định mức đã đặt ở danh mục SKU"
    : "Chưa có dữ liệu định mức từ máy chủ";

  return (
    <Box component="section" aria-labelledby="dashboard-threshold-title">
      <Box sx={{ mb: 1.5 }}>
        <Box component="h2" id="dashboard-threshold-title" sx={SECTION_TITLE_SX}>
          Định mức tồn kho
        </Box>
        <Box sx={{ ...CAPTION_SX, mt: 0.5 }}>{configuredNote}</Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <ThresholdCard
          label="Tồn dưới định mức"
          value={available ? threshold.below_min : null}
          note="SKU có tồn khả dụng thấp hơn định mức tối thiểu — cần nhập bổ sung."
          icon={<WarningOutlined />}
          color={CHART_COLORS.danger}
          softColor={S.errorSoft}
          onClick={() => navigate(ROUTES.INVENTORY)}
        />
        <ThresholdCard
          label="Tồn vượt định mức"
          value={available ? threshold.above_max : null}
          note="SKU có tồn khả dụng cao hơn định mức tối đa — cân nhắc giảm nhập."
          icon={<StockOutlined />}
          color={CHART_COLORS.warning}
          softColor={S.warningSoft}
          onClick={() => navigate(ROUTES.INVENTORY)}
        />
      </Box>

      {!available ? (
        <Stack sx={{ mt: 1 }}>
          <Box sx={CAPTION_SX}>
            Chỉ số này sẽ hiển thị khi máy chủ bổ sung dữ liệu định mức vào báo
            cáo tổng quan. Định mức từng SKU được đặt tại màn Danh mục SKU.
          </Box>
        </Stack>
      ) : null}
    </Box>
  );
}

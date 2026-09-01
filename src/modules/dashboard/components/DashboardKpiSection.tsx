import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import { ROUTES } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import {
  StockOutlined,
  ImportOutlined,
  ExportOutlined,
} from "@/shared/components/icons";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import type { DashboardOverview, SkuTypeFilter } from "../types";
import { SegmentedToggle } from "./dashboard-ui";
import {
  CARD_SX,
  CAPTION_SX,
  SECTION_TITLE_SX,
  formatNumber,
} from "./dashboard-styles";

const SKU_TYPE_OPTIONS: ReadonlyArray<{
  value: SkuTypeFilter;
  labelKey: MessageKey;
}> = [
  { value: "ALL", labelKey: "dashboard.skuType.all" },
  { value: "PRODUCT", labelKey: "dashboard.skuType.product" },
  { value: "COMPONENT", labelKey: "dashboard.skuType.component" },
];

function pick(
  split: { product: number; component: number; total: number },
  filter: SkuTypeFilter,
): number {
  if (filter === "PRODUCT") return split.product;
  if (filter === "COMPONENT") return split.component;
  return split.total;
}

function KpiCard({
  label,
  value,
  note,
  icon,
  color,
  softColor,
  onClick,
  drillLabel,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactElement;
  color: string;
  softColor: string;
  onClick?: () => void;
  drillLabel?: string;
}) {
  const t = useT();
  const clickable = Boolean(onClick);
  return (
    <Box
      {...(clickable
        ? {
            component: "button",
            type: "button",
            onClick,
            "aria-label":
              drillLabel ?? t("dashboard.kpi.drillFallback", { label }),
          }
        : {})}
      sx={{
        ...CARD_SX,
        minWidth: 0,
        display: "grid",
        gap: 0.75,
        ...(clickable
          ? {
              textAlign: "left",
              width: "100%",
              cursor: "pointer",
              font: "inherit",
              transition: "border-color .15s, box-shadow .15s",
              "&:hover": {
                borderColor: color,
                boxShadow: S.shadowCard,
              },
              "&:focus-visible": {
                outline: `2px solid ${color}`,
                outlineOffset: 2,
              },
            }
          : {}),
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
        {formatNumber(value)}
      </Box>
      <Box sx={CAPTION_SX}>{note}</Box>
    </Box>
  );
}

export function DashboardKpiSection({ data }: { data: DashboardOverview }) {
  const [skuType, setSkuType] = useState<SkuTypeFilter>("ALL");
  const navigate = useNavigate();
  const t = useT();
  const { kpi } = data;

  const scopeNote =
    skuType === "PRODUCT"
      ? t("dashboard.kpi.scopeProductOnly")
      : skuType === "COMPONENT"
        ? t("dashboard.kpi.scopeComponentOnly")
        : t("dashboard.kpi.scopeBoth");

  return (
    <Box component="section" aria-labelledby="dashboard-kpi-title">
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
        <Box>
          <Box component="h2" id="dashboard-kpi-title" sx={SECTION_TITLE_SX}>
            {t("dashboard.kpi.sectionTitle")}
          </Box>
          <Box sx={{ ...CAPTION_SX, mt: 0.5 }}>
            {t("dashboard.kpi.scopePrefix")}{" "}
            {data.data_scope === "GLOBAL"
              ? t("dashboard.kpi.scopeGlobal")
              : t("dashboard.kpi.scopeWarehouses", {
                  count: data.scope_warehouse_ids?.length ?? 0,
                })}
          </Box>
        </Box>
        <SegmentedToggle
          options={SKU_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          value={skuType}
          onChange={setSkuType}
          label={t("dashboard.kpi.toggleLabel")}
        />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))",
          },
        }}
      >
        <KpiCard
          label={t("dashboard.kpi.onHand")}
          value={pick(kpi.on_hand, skuType)}
          note={t("dashboard.kpi.onHandNote", { scope: scopeNote })}
          icon={<StockOutlined />}
          color={CHART_COLORS.primary}
          softColor={S.primarySoft}
          onClick={() => navigate(ROUTES.INVENTORY)}
          drillLabel={t("dashboard.kpi.onHandDrill")}
        />
        <KpiCard
          label={t("dashboard.kpi.receiptToday")}
          value={pick(kpi.receipt_today, skuType)}
          note={t("dashboard.kpi.receiptNote", { scope: scopeNote })}
          icon={<ImportOutlined />}
          color={CHART_COLORS.success}
          softColor={S.successSoft}
          onClick={() => navigate(ROUTES.INBOUND)}
          drillLabel={t("dashboard.kpi.receiptDrill")}
        />
        <KpiCard
          label={t("dashboard.kpi.issueToday")}
          value={pick(kpi.issue_today, skuType)}
          note={t("dashboard.kpi.issueNote", { scope: scopeNote })}
          icon={<ExportOutlined />}
          color={CHART_COLORS.warning}
          softColor={S.warningSoft}
          onClick={() => navigate(ROUTES.OUTBOUND)}
          drillLabel={t("dashboard.kpi.issueDrill")}
        />
        <KpiCard
          label={t("dashboard.kpi.receiptMonth")}
          value={pick(kpi.receipt_month, skuType)}
          note={t("dashboard.kpi.receiptNote", { scope: scopeNote })}
          icon={<ImportOutlined />}
          color={CHART_COLORS.successDeep}
          softColor={S.successSoft}
          onClick={() => navigate(ROUTES.INBOUND)}
          drillLabel={t("dashboard.kpi.receiptDrill")}
        />
        <KpiCard
          label={t("dashboard.kpi.issueMonth")}
          value={pick(kpi.issue_month, skuType)}
          note={t("dashboard.kpi.issueNote", { scope: scopeNote })}
          icon={<ExportOutlined />}
          color={CHART_COLORS.warningDeep}
          softColor={S.warningSoft}
          onClick={() => navigate(ROUTES.OUTBOUND)}
          drillLabel={t("dashboard.kpi.issueDrill")}
        />
      </Box>
    </Box>
  );
}

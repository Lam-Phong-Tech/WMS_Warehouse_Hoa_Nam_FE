import { useState } from "react";
import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import type { DashboardOverview, DashboardTopSku } from "../types";
import { SegmentedToggle } from "./dashboard-ui";
import {
  CARD_SX,
  CAPTION_SX,
  SECTION_TITLE_SX,
  formatNumber,
} from "./dashboard-styles";

type WarrantyWindow = "today" | "week" | "month";

const WARRANTY_WINDOW_OPTIONS: ReadonlyArray<{
  value: WarrantyWindow;
  labelKey: MessageKey;
}> = [
  { value: "today", labelKey: "dashboard.period.today" },
  { value: "week", labelKey: "dashboard.period.week" },
  { value: "month", labelKey: "dashboard.period.month" },
];

function SkuHighlightCard({
  title,
  sku,
  note,
  emptyText,
  tone,
}: {
  title: string;
  sku: DashboardTopSku | null;
  note: string;
  emptyText: string;
  tone: string;
}) {
  const t = useT();
  return (
    <Box sx={{ ...CARD_SX, display: "grid", gap: 0.75, minWidth: 0 }}>
      <Box component="h3" sx={{ ...SECTION_TITLE_SX, fontSize: 15 }}>
        {title}
      </Box>
      {sku ? (
        <>
          <Box
            sx={{
              fontSize: 18,
              fontWeight: 700,
              color: tone,
              overflowWrap: "anywhere",
            }}
          >
            {sku.sku_name}
          </Box>
          <Box sx={{ ...CAPTION_SX, fontFamily: "monospace" }}>
            {sku.sku_code}
          </Box>
          <Box
            sx={{
              fontSize: TYPOGRAPHY.fontSizeSecondary,
              color: S.textHigh,
              fontWeight: 700,
            }}
          >
            {t("dashboard.highlights.issuedQty", {
              qty: formatNumber(sku.issue_qty),
            })}
          </Box>
          <Box sx={CAPTION_SX}>{note}</Box>
        </>
      ) : (
        <Box
          sx={{
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
            py: 1,
          }}
        >
          {emptyText}
        </Box>
      )}
    </Box>
  );
}

export function DashboardHighlights({ data }: { data: DashboardOverview }) {
  const [warrantyWindow, setWarrantyWindow] = useState<WarrantyWindow>("today");
  const t = useT();

  return (
    <Box
      component="section"
      aria-label={t("dashboard.highlights.sectionLabel")}
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
      }}
    >
      <Box sx={{ ...CARD_SX, display: "grid", gap: 1, minWidth: 0 }}>
        <Box component="h3" sx={{ ...SECTION_TITLE_SX, fontSize: 15 }}>
          {t("dashboard.highlights.warrantyReceived")}
        </Box>
        <SegmentedToggle
          options={WARRANTY_WINDOW_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          value={warrantyWindow}
          onChange={setWarrantyWindow}
          label={t("dashboard.highlights.warrantyToggleLabel")}
        />
        <Box
          sx={{
            fontSize: "clamp(26px, 3vw, 34px)",
            fontWeight: 700,
            color: S.textHigh,
          }}
        >
          {formatNumber(data.warranty_received[warrantyWindow])}
        </Box>
        <Box sx={CAPTION_SX}>{t("dashboard.highlights.warrantyNote")}</Box>
      </Box>

      <SkuHighlightCard
        title={t("dashboard.highlights.bestSku")}
        sku={data.top_sku.best}
        note={t("dashboard.highlights.bestSkuNote")}
        emptyText={t("dashboard.highlights.skuEmpty")}
        tone={S.successText}
      />
      <SkuHighlightCard
        title={t("dashboard.highlights.worstSku")}
        sku={data.top_sku.worst}
        note={t("dashboard.highlights.worstSkuNote")}
        emptyText={t("dashboard.highlights.skuEmpty")}
        tone={S.warningText}
      />
    </Box>
  );
}

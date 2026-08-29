import { useState } from "react";
import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
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
  label: string;
}> = [
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
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
            Đã xuất {formatNumber(sku.issue_qty)}
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

  return (
    <Box
      component="section"
      aria-label="Bảo hành tiếp nhận và SKU nổi bật"
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
      }}
    >
      <Box sx={{ ...CARD_SX, display: "grid", gap: 1, minWidth: 0 }}>
        <Box component="h3" sx={{ ...SECTION_TITLE_SX, fontSize: 15 }}>
          Số máy tiếp nhận bảo hành
        </Box>
        <SegmentedToggle
          options={WARRANTY_WINDOW_OPTIONS}
          value={warrantyWindow}
          onChange={setWarrantyWindow}
          label="Chọn kỳ xem số máy tiếp nhận bảo hành"
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
        <Box sx={CAPTION_SX}>
          Tính theo ngày tiếp nhận. Số liệu bảo hành là toàn hệ thống, không
          giới hạn theo kho.
        </Box>
      </Box>

      <SkuHighlightCard
        title="SKU xuất nhiều nhất"
        sku={data.top_sku.best}
        note="Xuất nhiều nhất trong kỳ đang xem"
        emptyText="Kỳ này chưa phát sinh xuất hàng."
        tone={S.successText}
      />
      <SkuHighlightCard
        title="SKU xuất ít nhất"
        sku={data.top_sku.worst}
        note="Ít nhất trong số các SKU có phát sinh xuất"
        emptyText="Kỳ này chưa phát sinh xuất hàng."
        tone={S.warningText}
      />
    </Box>
  );
}

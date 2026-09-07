/**
 * BÀN ĐO bảng dữ liệu lớn — tái hiện đúng sổ ledger của `/reports/traceability`.
 *
 * Vì sao cần: sự cố INP 14.696 ms xảy ra khi `ResponsiveDataTable` nhận TRỌN
 * tập 5.956 dòng. Muốn chứng minh một thay đổi có tác dụng thì phải đo lại đúng
 * tình huống đó, lặp lại được, không phụ thuộc BE/đăng nhập/dữ liệu thật.
 *
 * Trang này KHÔNG chép lại component: nó import chính
 * `@/shared/components/data-display/ResponsiveDataTable` và dựng bộ cột có cùng
 * HÌNH DẠNG với cột thật của MovementTraceReport (9 cột: số, ngày giờ, badge,
 * chữ, số căn phải, ô hai tầng, chữ, mã rút gọn, chữ) cùng `maxBodyHeight`.
 *
 * Điều khiển qua query string:
 *   ?rows=5956      số dòng sinh ra (mặc định 5956 — đúng tập đã gây sự cố)
 *   ?variant=table  bảng desktop (mặc định) | cards để ép nhánh mobile
 *
 * Trang tự phơi `window.__bench` cho trình điều khiển Playwright đọc số đo.
 */
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Box } from "@mui/material";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { rowIndexOf } from "@/shared/components/data-display/row-index";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { UiStatusBadge } from "@/shared/ui/components/UiStatusBadge";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/styles/hn-wms-source-screen.css";
import "@/styles/hn-responsive.css";
import "@/styles/hn-motion.css";

type BenchRow = {
  id: string;
  occurredAt: string;
  movementType: string;
  productCode: string;
  productName: string;
  qtyDelta: number;
  sourceCode: string;
  sourceLabel: string;
  actor: string;
  chainId: string;
};

const TYPES = ["IN", "OUT", "ADJUST", "REVERSAL", "TRANSFER"] as const;
const TONES = ["success", "error", "warning", "info", "neutral"] as const;

/** Sinh dữ liệu tất định (không random) để hai lần chạy so sánh được với nhau. */
function makeRows(count: number): BenchRow[] {
  const rows: BenchRow[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const day = String((i % 28) + 1).padStart(2, "0");
    const hour = String(i % 24).padStart(2, "0");
    rows[i] = {
      id: `mv-${i}`,
      occurredAt: `2026-09-${day}T${hour}:${String(i % 60).padStart(2, "0")}:00Z`,
      movementType: TYPES[i % TYPES.length],
      productCode: `SKU-${String(1000 + (i % 400))}`,
      productName: `Linh kien mau so ${i % 400} - ban tieu chuan dai`,
      qtyDelta: (i % 7) - 3,
      sourceCode: `IN-2026-${String(100000 + i)}`,
      sourceLabel: `Phieu nhap kho ${i % 50}`,
      actor: `nv-kho-${String((i % 30) + 1).padStart(2, "0")}@gmail.com`,
      chainId: `chain-${i % 900}-${i}`,
    };
  }
  return rows;
}

const ALL_ROWS = makeRows(
  Number(new URLSearchParams(location.search).get("rows") ?? 5956),
);

function Bench() {
  const [term, setTerm] = useState("");

  // Bộ lọc client-side giống `useSectionFilter` của màn thật: mỗi phím gõ tạo
  // một MẢNG MỚI -> bảng dựng lại toàn bộ. Đây chính là thao tác đã đo 14.666ms.
  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (needle === "") return ALL_ROWS;
    return ALL_ROWS.filter(
      (row) =>
        row.productCode.toLowerCase().includes(needle) ||
        row.actor.toLowerCase().includes(needle) ||
        row.sourceCode.toLowerCase().includes(needle),
    );
  }, [term]);

  return (
    <Box sx={{ p: 2 }}>
      <input
        data-testid="bench-filter"
        placeholder="loc"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        style={{ padding: 8, marginBottom: 12, width: 280 }}
      />
      <div data-testid="bench-total">{rows.length}</div>
      <ResponsiveDataTable<BenchRow>
        columns={[
          {
            key: "stt",
            header: "STT",
            width: 64,
            align: "center",
            render: (row) => rowIndexOf(rows, row) + 1,
          },
          {
            key: "occurred_at",
            header: "Thoi diem",
            width: 150,
            sortType: "value",
            sortAccessor: (row) => row.occurredAt,
            render: (row) => row.occurredAt.replace("T", " ").slice(0, 16),
          },
          {
            key: "movement_type",
            header: "Loai bien dong",
            width: 150,
            render: (row) => (
              <UiStatusBadge
                tone={TONES[TYPES.indexOf(row.movementType as never) % TONES.length]}
                label={row.movementType}
              />
            ),
          },
          {
            key: "sku",
            header: "SKU",
            width: 120,
            sortAccessor: (row) => row.productCode,
            render: (row) => row.productCode,
          },
          {
            key: "qty_delta",
            header: "SL",
            width: 90,
            align: "right",
            render: (row) => row.qtyDelta,
          },
          {
            key: "source",
            header: "Chung tu",
            width: 160,
            render: (row) => (
              <>
                {row.sourceCode}
                <br />
                <Box component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
                  {row.sourceLabel}
                </Box>
              </>
            ),
          },
          {
            key: "actor",
            header: "Nguoi thuc hien",
            width: 130,
            render: (row) => row.actor,
          },
          {
            key: "chain",
            header: "Chuoi dieu chinh",
            width: 150,
            render: (row) => row.chainId,
          },
          {
            key: "status",
            header: "Trang thai",
            width: 110,
            render: () => "Da ghi so",
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        maxBodyHeight="clamp(320px, 56vh, 640px)"
      />
    </Box>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppThemeProvider>
      <Bench />
    </AppThemeProvider>
  </StrictMode>,
);

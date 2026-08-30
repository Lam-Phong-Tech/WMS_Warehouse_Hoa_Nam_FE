import { useMemo, useState } from "react";
import { Box, Stack, UiAlert, UiStatusBadge, UiTimeline } from "@/shared/ui";
import type { UiStatusTone, UiTimelineItem } from "@/shared/ui";
import {
  BarcodeOutlined,
  NodeIndexOutlined,
  ScanOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { businessLabel } from "@/shared/constants/business-labels";
import {
  fmt,
  fmtDate,
  fmtDateTime,
  listOf,
  n,
  text,
  type ItemKind,
  type Raw,
} from "./report-format";
import {
  useDocumentHistory,
  useMovementTrace,
  useSkuCatalog,
  useTraceByCode,
} from "./report-data";
import {
  DrillDownDialog,
  FilterBar,
  FormulaNote,
  ReportKpi,
  ReportKpiRow,
  ReportSectionHeading,
} from "./report-ui";
import {
  AllOrPickFilter,
  ItemKindFilter,
  PeriodFilterControls,
} from "./report-filters";
import { usePeriodFilter } from "./report-period";
import { MOVEMENT_LABELS } from "./report-labels";
import { ReportPaginationBar } from "./report-table";
import { useClientPagination } from "./report-columns";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { MovementTable } from "./report-drilldown";

/** Trạng thái vòng đời suy ra từ movement gần nhất của một mã vật lý. */
const LIFECYCLE_STATES = {
  IN_STOCK: { label: "Đang trong kho", tone: "success" as UiStatusTone },
  ISSUED: { label: "Đã xuất kho", tone: "info" as UiStatusTone },
  COMPONENT_ISSUED: {
    label: "Đã xuất làm linh kiện bảo hành",
    tone: "primary" as UiStatusTone,
  },
  REVERSED: {
    label: "Đã hoàn trả / điều chỉnh",
    tone: "warning" as UiStatusTone,
  },
  UNKNOWN: { label: "Chưa xác định", tone: "neutral" as UiStatusTone },
} as const;

type LifecycleState = keyof typeof LIFECYCLE_STATES;

const STATE_FILTER_OPTIONS = (
  Object.keys(LIFECYCLE_STATES) as LifecycleState[]
).map((value) => ({ value, label: LIFECYCLE_STATES[value].label }));

/** Mục 7: lọc trực tiếp theo LOẠI MOVEMENT (không chỉ trạng thái vòng đời). */
const MOVEMENT_TYPE_FILTER_OPTIONS = (
  ["RECEIPT", "ISSUE", "COMPONENT_ISSUE", "REVERSAL", "OPENING"] as const
).map((value) => ({
  value,
  label: businessLabel(MOVEMENT_LABELS, value),
}));

function stateOfMovement(movementType: string): LifecycleState {
  if (movementType === "RECEIPT" || movementType === "OPENING") {
    return "IN_STOCK";
  }
  if (movementType === "ISSUE") return "ISSUED";
  if (movementType === "COMPONENT_ISSUE") return "COMPONENT_ISSUED";
  if (movementType === "REVERSAL") return "REVERSED";
  return "UNKNOWN";
}

/** Mốc vòng đời hiển thị trên timeline dọc (mục 3.2). */
function lifecycleStage(row: Raw): { title: string; tone: UiStatusTone } {
  const type = text(row.movement_type, "");
  const source = text(row.source_type, "").toUpperCase();
  if (source.includes("PUTAWAY")) {
    return { title: "Putaway — cất hàng vào vị trí", tone: "info" };
  }
  if (source.includes("WARRANTY") || type === "COMPONENT_ISSUE") {
    return { title: "Bảo hành — xuất linh kiện", tone: "primary" };
  }
  if (type === "RECEIPT" || type === "OPENING") {
    return { title: "Nhập kho", tone: "success" };
  }
  if (type === "ISSUE") return { title: "Xuất kho", tone: "info" };
  if (type === "REVERSAL") {
    return { title: "Trả hàng / Reversal", tone: "warning" };
  }
  return { title: businessLabel(MOVEMENT_LABELS, type), tone: "neutral" };
}

type TraceItem = {
  key: string;
  physicalCode: string;
  productCode: string;
  productName: string;
  kind: ItemKind;
  state: LifecycleState;
  receivedAt: string;
  issuedAt: string;
  recipient: string;
  lastMovement: string;
  lastMovementAt: string;
  movements: Raw[];
};

/**
 * Tab 3 — Truy vết hàng hóa.
 *
 * Sổ `stock_movements` là nguồn duy nhất có mã vật lý gắn với thời điểm, nên
 * danh sách 3.1 được dựng bằng cách GỘP sổ biến động theo mã vật lý thay vì đọc
 * một bảng "sản phẩm" nào khác — như vậy mọi cột ngày/trạng thái trên bảng đều
 * truy ngược được về đúng dòng ledger sinh ra nó.
 */
export default function TabTraceability() {
  const catalog = useSkuCatalog();
  const period = usePeriodFilter("this-month");
  const [keyword, setKeyword] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<ItemKind>("all");
  const [selected, setSelected] = useState<TraceItem | null>(null);

  const ledger = useMovementTrace({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });
  const documents = useDocumentHistory({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });

  /** id chứng từ → tên đối tác, để điền cột "Người nhận gần nhất". */
  const counterpartByDocument = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of listOf(documents.data?.rows)) {
      map.set(text(row.id, ""), text(row.counterpart, ""));
    }
    return map;
  }, [documents.data]);

  const items = useMemo<TraceItem[]>(() => {
    const byKey = new Map<string, Raw[]>();
    for (const row of listOf(ledger.data?.rows)) {
      // Không có mã vật lý thì gộp theo item/container; cuối cùng mới theo SKU
      // (dòng ledger cấp số lượng, không gắn hiện vật cụ thể).
      const key =
        text(row.physical_code, "") ||
        text(row.item_id, "") ||
        text(row.container_id, "") ||
        `sku:${text(row.product_code, "")}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.push(row);
      else byKey.set(key, [row]);
    }

    return [...byKey.entries()].map(([key, movements]) => {
      const sorted = [...movements].sort((a, b) =>
        text(a.occurred_at, "").localeCompare(text(b.occurred_at, "")),
      );
      const last = sorted[sorted.length - 1] ?? {};
      const first = sorted[0] ?? {};
      const receipt = sorted.find((row) =>
        ["RECEIPT", "OPENING"].includes(text(row.movement_type, "")),
      );
      const issue = [...sorted]
        .reverse()
        .find((row) =>
          ["ISSUE", "COMPONENT_ISSUE"].includes(text(row.movement_type, "")),
        );
      const productCode = text(first.product_code, "");
      const catalogEntry = catalog.byCode.get(productCode);

      return {
        key,
        physicalCode: text(first.physical_code, ""),
        productCode,
        productName: text(first.product_name, catalogEntry?.sku_name ?? ""),
        kind: (catalogEntry?.sku_type ?? "all") as ItemKind,
        state: stateOfMovement(text(last.movement_type, "")),
        receivedAt: text(receipt?.occurred_at, ""),
        issuedAt: text(issue?.occurred_at, ""),
        recipient: issue
          ? (counterpartByDocument.get(text(issue.source_id, "")) ?? "")
          : "",
        lastMovement: businessLabel(
          MOVEMENT_LABELS,
          text(last.movement_type, ""),
        ),
        lastMovementAt: text(last.occurred_at, ""),
        movements: [...sorted].reverse(),
      };
    });
  }, [ledger.data, catalog, counterpartByDocument]);

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return items.filter((item) => {
      if (stateFilter && item.state !== stateFilter) return false;
      if (skuFilter && item.productCode !== skuFilter) return false;
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (
        movementTypeFilter &&
        !item.movements.some(
          (m) => text(m.movement_type, "") === movementTypeFilter,
        )
      ) {
        return false;
      }
      if (
        actorFilter &&
        !item.movements.some((m) => text(m.actor, "") === actorFilter)
      ) {
        return false;
      }
      if (needle) {
        const haystack =
          `${item.productCode} ${item.productName} ${item.physicalCode}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [
    items,
    keyword,
    stateFilter,
    movementTypeFilter,
    actorFilter,
    skuFilter,
    kindFilter,
  ]);

  const pagination = useClientPagination(filtered, 15);

  const skuOptions = useMemo(() => {
    const codes = new Set(
      items.map((item) => item.productCode).filter((code) => code !== ""),
    );
    return [...codes]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((code) => ({ value: code, label: code }));
  }, [items]);

  const actorOptions = useMemo(() => {
    const actors = new Set<string>();
    for (const item of items) {
      for (const m of item.movements) {
        const actor = text(m.actor, "");
        if (actor !== "" && actor !== "—") actors.add(actor);
      }
    }
    return [...actors]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((actor) => ({ value: actor, label: actor }));
  }, [items]);

  // ── 3.2 Vòng đời của mã vật lý đang chọn ───────────────────────────────
  const trace = useTraceByCode(selected?.physicalCode ?? "");
  const traceMovements = useMemo(() => {
    const remote = listOf(trace.data?.movements);
    // trace-by-code đọc toàn bộ lịch sử (không giới hạn kỳ đang lọc) nên ưu
    // tiên nó; khi mã không phải physical code thì quay về đúng các movement
    // đã gộp ở bảng 3.1.
    return remote.length > 0 ? remote : (selected?.movements ?? []);
  }, [trace.data, selected]);

  const timelineItems = useMemo<UiTimelineItem[]>(() => {
    return [...traceMovements]
      .sort((a, b) =>
        text(b.occurred_at, "").localeCompare(text(a.occurred_at, "")),
      )
      .map((row) => {
        const stage = lifecycleStage(row);
        const delta = n(row.qty_delta);
        return {
          title: stage.title,
          tone: stage.tone,
          time: fmtDateTime(row.occurred_at),
          description: (
            <Stack spacing={0.25}>
              <Box>
                {text(row.product_code)} · {text(row.product_name, "")}
              </Box>
              <Box>
                Số lượng: {delta >= 0 ? "+" : "−"}
                {fmt(Math.abs(delta))} · Kho {text(row.warehouse_code)}
                {text(row.doc_no, "") !== "—"
                  ? ` · Chứng từ ${text(row.doc_no, "—")}`
                  : ""}
              </Box>
              <Box>Người thực hiện: {text(row.actor)}</Box>
            </Stack>
          ),
        };
      });
  }, [traceMovements]);

  const loading = ledger.isLoading || catalog.loading;

  const inStockCount = filtered.filter(
    (item) => item.state === "IN_STOCK",
  ).length;
  const issuedCount = filtered.filter(
    (item) => item.state === "ISSUED" || item.state === "COMPONENT_ISSUED",
  ).length;

  return (
    <Box data-testid="rpt-tab-traceability">
      <ReportSectionHeading
        id="rpt-tab3-heading"
        title="Báo cáo truy vết hàng hóa"
        description="Tìm theo Tên / SKU / Physical Code / Serial rồi mở vòng đời của đúng hiện vật đó."
      />

      <FilterBar
        label="Bộ lọc danh sách sản phẩm"
        hint={`Thời gian nhập/xuất: ${period.label} · ${fmt(filtered.length)} hiện vật`}
      >
        <SearchInput
          width={300}
          placeholder="Tên / SKU / Physical Code / Serial"
          aria-label="Tìm theo tên, SKU, physical code hoặc serial"
          value={keyword}
          onChange={setKeyword}
        />
        <PeriodFilterControls state={period} />
        <AllOrPickFilter
          value={skuFilter}
          onChange={setSkuFilter}
          options={skuOptions}
          allLabel="Tất cả SKU"
          ariaLabel="SKU"
        />
        <AllOrPickFilter
          value={stateFilter}
          onChange={setStateFilter}
          options={STATE_FILTER_OPTIONS}
          allLabel="Tất cả trạng thái"
          ariaLabel="Trạng thái hiện tại"
          minWidth={220}
        />
        <AllOrPickFilter
          value={movementTypeFilter}
          onChange={setMovementTypeFilter}
          options={MOVEMENT_TYPE_FILTER_OPTIONS}
          allLabel="Tất cả loại movement"
          ariaLabel="Loại movement"
          minWidth={200}
        />
        <AllOrPickFilter
          value={actorFilter}
          onChange={setActorFilter}
          options={actorOptions}
          allLabel="Tất cả người thực hiện"
          ariaLabel="Người thực hiện"
          minWidth={200}
        />
        <ItemKindFilter value={kindFilter} onChange={setKindFilter} />
      </FilterBar>

      {period.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
          </UiAlert>
        </Box>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label="Hiện vật truy được"
          value={fmt(filtered.length)}
          tone="primary"
          icon={<BarcodeOutlined />}
          hint="Gộp theo Physical Code / Serial trong kỳ đang lọc"
        />
        <ReportKpi
          label="Đang trong kho"
          value={fmt(inStockCount)}
          tone="success"
          icon={<ScanOutlined />}
          onClick={() => setStateFilter("IN_STOCK")}
        />
        <ReportKpi
          label="Đã xuất"
          value={fmt(issuedCount)}
          tone="info"
          icon={<NodeIndexOutlined />}
          hint="Gồm xuất bán và xuất linh kiện bảo hành"
          onClick={() => setStateFilter("ISSUED")}
        />
      </ReportKpiRow>

      {ledger.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={ledger.error}
            title="Không tải được sổ biến động để truy vết"
            onRetry={() => void ledger.refetch()}
          />
        </Box>
      ) : null}

      <ResponsiveDataTable<TraceItem>
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
            key: "productCode",
            header: "SKU",
            width: 150,
            sortAccessor: (row) => row.productCode,
            render: (row) => (
              <Box sx={{ fontWeight: 700 }}>{row.productCode || "—"}</Box>
            ),
          },
          {
            key: "productName",
            header: "Tên sản phẩm",
            sortAccessor: (row) => row.productName,
            render: (row) => row.productName || "—",
          },
          {
            key: "physicalCode",
            header: "Physical Code / Serial",
            width: 200,
            sortAccessor: (row) => row.physicalCode,
            render: (row) => row.physicalCode || "—",
          },
          {
            key: "state",
            header: "Trạng thái hiện tại",
            width: 200,
            render: (row) => (
              <UiStatusBadge
                size="small"
                tone={LIFECYCLE_STATES[row.state].tone}
                label={LIFECYCLE_STATES[row.state].label}
              />
            ),
          },
          {
            key: "receivedAt",
            header: "Ngày nhập",
            width: 130,
            sortAccessor: (row) => row.receivedAt,
            render: (row) => (row.receivedAt ? fmtDate(row.receivedAt) : "—"),
          },
          {
            key: "issuedAt",
            header: "Ngày xuất",
            width: 130,
            sortAccessor: (row) => row.issuedAt,
            render: (row) => (row.issuedAt ? fmtDate(row.issuedAt) : "—"),
          },
          {
            key: "recipient",
            header: "Người nhận gần nhất",
            hideOnMobile: true,
            render: (row) => row.recipient || "—",
          },
          {
            key: "lastMovement",
            header: "Movement gần nhất",
            width: 180,
            render: (row) => row.lastMovement,
          },
          {
            key: "lastMovementAt",
            header: "Cập nhật cuối",
            width: 165,
            sortAccessor: (row) => row.lastMovementAt,
            render: (row) =>
              row.lastMovementAt ? fmtDateTime(row.lastMovementAt) : "—",
          },
        ]}
        rows={pagination.pageRows}
        rowKey={(row) => row.key}
        loading={loading}
        onRowClick={(row) => setSelected(row)}
        emptyText="Không tìm thấy hiện vật nào theo bộ lọc."
      />
      <ReportPaginationBar
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPerPage}
      />

      {selected ? (
        <DrillDownDialog
          title={`Vòng đời — ${selected.physicalCode || selected.productCode}`}
          subtitle={`${selected.productCode} · ${selected.productName}`}
          onClose={() => setSelected(null)}
        >
          {trace.isError ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="warning">
                Không tra được mã vật lý này qua dịch vụ truy vết; timeline dưới
                đây dựng từ sổ biến động trong kỳ đang lọc.
              </UiAlert>
            </Box>
          ) : null}
          {timelineItems.length === 0 ? (
            <UiAlert tone="info">
              Hiện vật này chưa có mốc vòng đời nào trong dữ liệu truy vết.
            </UiAlert>
          ) : (
            <>
              <UiTimeline items={timelineItems} />
              <Box sx={{ mt: 2 }}>
                <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                  Movement liên quan
                </Box>
                <MovementTable
                  rows={traceMovements}
                  loading={trace.isLoading}
                />
              </Box>
              <FormulaNote>
                Mốc được suy từ `movement_type` và `source_type` của từng dòng
                sổ biến động: Putaway/Bảo hành nhận diện qua nguồn phát sinh,
                Nhập/Xuất/Reversal nhận diện qua loại biến động.
              </FormulaNote>
            </>
          )}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}

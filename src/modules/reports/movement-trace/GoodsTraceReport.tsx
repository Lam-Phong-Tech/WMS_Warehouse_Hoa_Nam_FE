import { businessToday } from "@/shared/utils/date-time";
import { parseDateTime } from "@/shared/utils/date-time";
import { useDateTimePreferences } from "@/shared/store/interface-preferences.store";
import { saveStyledReportWorkbook } from "@/shared/utils/report-excel-style";
import { useRef, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import {
  FileTextOutlined,
  InboxOutlined,
  StockOutlined,
  BarChartOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { Drawer, UiSelect, FILTER_WIDTH } from "@/shared/ui";
import { ReportDateRangePicker } from "../components/ReportDateRangePicker";
import {
  hasPermission,
  usePermissionState,
} from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { FlowDocumentDetailModal } from "../inventory-flow/FlowDocumentDetailModal";
import { DrillDownModal } from "../inventory-flow/inventory-flow-overlays";
import { ReversalDetailModal } from "@/modules/reverse/components/ReversalDetailModal";
import {
  useGoodsTraceReport,
  goodsTraceSourcePath,
  type GoodsTraceEvent,
  type GoodsTraceEntity,
  type GoodsTraceQuery,
} from "./goods-trace-api";
import {
  enumLabelOrText,
  ITEM_STATUS_LABELS,
  MOVEMENT_STATUS_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
} from "@/shared/constants/business-labels";
import { rowActivationProps } from "@/shared/components/data-display/row-activation";
import "./goods-trace-report.css";
const sourceLabels = {
  ...SOURCE_DOCUMENT_TYPE_LABELS,
  INBOUND: "Phiếu nhập kho",
  INBOUND_DOCUMENT: "Phiếu nhập kho",
  OUTBOUND: "Phiếu xuất kho",
  OUTBOUND_DOCUMENT: "Phiếu xuất kho",
  PUTAWAY: "Phiếu xếp khay",
  LABEL: "In nhãn",
  WARRANTY: "Bảo hành",
  REVERSAL_DOCUMENT: "Phiếu đảo",
  RECEIPT_DOCUMENT: "Phiếu nhập kho",
  ISSUE_DOCUMENT: "Phiếu xuất kho",
  LABEL_PRINT: "In nhãn",
};
const sourceLabel = (value: string) =>
  enumLabelOrText(sourceLabels, value) || "—";
const empty = "—";
const text = (value: unknown) =>
  value === null || value === undefined || value === "" ? empty : String(value);
const time = (value: string) =>
  value && parseDateTime(value).isValid()
    ? parseDateTime(value).format("DD/MM/YYYY HH:mm")
    : empty;
const number = (value: number | null | undefined) =>
  value == null ? empty : value.toLocaleString("vi-VN");
const delta = (value: number | null | undefined) =>
  value == null ? empty : `${value > 0 ? "+" : ""}${number(value)}`;
const isStockEvent = (event: GoodsTraceEvent) =>
  event.qty_delta != null
    ? event.qty_delta !== 0
    : /RECEIPT|ISSUE|REVERSAL|INBOUND|OUTBOUND|STOCK|ADJUST|TRANSFER/.test(
        event.event_type.toUpperCase(),
      );
const netDelta = (events: GoodsTraceEvent[]): number | null =>
  events.some((e) => isStockEvent(e) && e.qty_delta == null)
    ? null
    : events.reduce((sum, e) => sum + (e.qty_delta ?? 0), 0);
const codeTypes = [
  ["all", "Tất cả"],
  ["serial", "Serial"],
  ["box", "BOX"],
  ["tray", "TRAY"],
  ["document", "Chứng từ"],
  ["sku", "SKU"],
];
function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`goods-trace-panel ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="goods-trace-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export default function GoodsTraceReport() {
  useDateTimePreferences();
  const [query, setQuery] = useState<GoodsTraceQuery>({
    code_type: "all",
    from_date: businessToday().subtract(6, "day").format("YYYY-MM-DD"),
    to_date: businessToday().format("YYYY-MM-DD"),
  });
  const [profile, setProfile] = useState<GoodsTraceEntity | null>(null);
  const [tab, setTab] = useState("timeline");
  const [selected, setSelected] = useState<GoodsTraceEvent | null>(null);
  const [source, setSource] = useState<GoodsTraceEvent | null>(null);
  const [sourceTrace, setSourceTrace] = useState<GoodsTraceEvent | null>(null);
  const [stockOnly, setStockOnly] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStock, setExportStock] = useState(false);
  const [sections, setSections] = useState({
    events: true,
    documents: true,
    relations: false,
  });
  const [filename, setFilename] = useState("BaoCaoTruyVet.xlsx");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const input = useRef<HTMLInputElement>(null);
  const permissions = usePermissionState();
  const canExport = hasPermission(
    WMS_PERMISSION_CATALOG.REPORT_EXPORT,
    permissions,
  );
  const result = useGoodsTraceReport(query);
  const data = result.isError || result.isFetching ? undefined : result.data;
  const allEvents = data?.events ?? [];
  const activeProfile = profile
    ? (data?.entities.find((e) => e.key === profile.key) ?? null)
    : query.code
      ? (data?.entities.find(
          (e) => e.code.toLowerCase() === query.code?.toLowerCase(),
        ) ?? null)
      : null;
  const profileEvents = activeProfile
    ? allEvents.filter(
        (e) =>
          e.entity_key === activeProfile.key ||
          e.code === activeProfile.code ||
          e.related_entity_keys?.includes(activeProfile.key),
      )
    : allEvents;
  const rows = profileEvents
    .filter((e) => !stockOnly || isStockEvent(e))
    .slice()
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const stockCount = profileEvents.filter(isStockEvent).length;
  const codes = new Set(profileEvents.map((e) => e.code).filter(Boolean)).size;
  const net = netDelta(profileEvents);
  const complete = data?.complete === true;
  const update = (patch: Partial<GoodsTraceQuery>) => {
    setQuery((q) => ({ ...q, ...patch }));
    setPage(1);
    setProfile(null);
  };
  const reset = () => {
    setQuery({ code_type: "all" });
    setStockOnly(false);
    setProfile(null);
    setPage(1);
  };
  const expand = () => update({ from_date: undefined, to_date: undefined });
  const filtered = Boolean(
    query.code ||
    query.code_type !== "all" ||
    query.from_date ||
    query.to_date ||
    query.activity_type ||
    query.source ||
    query.actor ||
    query.relation,
  );
  const openSource = (event: GoodsTraceEvent) => {
    const normalized = {
      ...event,
      source_type: event.source_type.toUpperCase(),
    };
    if (
      [
        "INBOUND",
        "OUTBOUND",
        "INBOUND_DOCUMENT",
        "OUTBOUND_DOCUMENT",
        "RECEIPT_DOCUMENT",
        "ISSUE_DOCUMENT",
      ].includes(normalized.source_type) &&
      normalized.source_id
    )
      setSource(normalized);
    else setSourceTrace(normalized);
  };
  const queryInfo = (
    <Facts
      rows={[
        ["Mã cần truy vết", text(activeProfile?.code || query.code)],
        [
          "Loại mã",
          codeTypes.find((x) => x[0] === query.code_type)?.[1] ?? "Tất cả",
        ],
        [
          "Khoảng ngày",
          `${query.from_date ? dayjs(query.from_date).format("DD/MM/YYYY") : "Tất cả"} – ${query.to_date ? dayjs(query.to_date).format("DD/MM/YYYY") : "Tất cả"}`,
        ],
        ["Loại hoạt động", query.activity_type || "Tất cả"],
        ["Thời điểm cập nhật", time(data?.data_as_of ?? "")],
        ["Nguồn dữ liệu", "Số liệu nghiệp vụ trong hệ thống Hoa Nam WMS"],
      ]}
    />
  );
  async function exportFile() {
    if (!canExport || !complete || !data || result.isError) return;
    setExporting(true);
    setExportError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const events = rows.filter((e) => !exportStock || isStockEvent(e));
      const safe = (value: unknown) =>
        typeof value === "string" && /^[=+@-]/.test(value)
          ? `'${value}`
          : value;
      const append = (name: string, values: Record<string, unknown>[]) =>
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            values.map((row) =>
              Object.fromEntries(
                Object.entries(row).map(([key, value]) => [key, safe(value)]),
              ),
            ),
          ),
          name,
        );
      if (sections.events)
        append(
          "Su kien",
          events.map((e) => ({
            "Thời điểm": e.occurred_at,
            "Thời điểm ghi nhận": e.recorded_at,
            "Trạng thái": e.status,
            Kho: e.warehouse_code,
            "Vị trí trước": e.location_before,
            "Vị trí sau": e.location_after,
            "Số lượng": e.quantity,
            "Số lượng trên phiếu": e.source_quantity,
            "Số lượng mã đang xem": e.entity_quantity,
            Mã: e.code,
            SKU: e.sku_code,
            "Sự kiện": e.event_label,
            "Chứng từ": e.source_no,
            "Biến động tồn mã đang xem": e.qty_delta,
            "Biến động sổ kho nguồn": e.source_qty_delta,
            "Tồn trước": e.qty_before,
            "Tồn sau": e.qty_after,
            "Người thực hiện": e.actor,
          })),
        );
      if (sections.documents)
        append(
          "Chung tu",
          events.flatMap((e) => [
            { "Sự kiện": e.id, "Chứng từ": e.source_no, Loại: e.source_type },
            ...e.related_documents.map((d) => ({
              "Sự kiện": e.id,
              "Chứng từ": d.code,
              Loại: d.type,
            })),
          ]),
        );
      const eventCodes = new Set(events.map((e) => e.code));
      if (sections.relations)
        append(
          "BOX TRAY",
          data.relations
            .filter(
              (r) =>
                eventCodes.has(r.parent_code) ||
                eventCodes.has(r.child_code) ||
                activeProfile?.code === r.parent_code ||
                activeProfile?.code === r.child_code,
            )
            .map((r) => ({
              "Mã cha": r.parent_code,
              "Mã con": r.child_code,
              SKU: r.sku_code,
              "Số lượng": r.quantity,
              "Vị trí": r.location,
            })),
        );
      append("Thong tin truy van", [
        {
          ...query,
          profile_code: activeProfile?.code ?? "",
          "Chỉ tác động tồn": stockOnly || exportStock,
          "Thời điểm dữ liệu": data.data_as_of,
          "Số sự kiện xuất": events.length,
          "Sự kiện tác động tồn": events.filter(isStockEvent).length,
          "Ảnh hưởng thuần": netDelta(events),
          "Mã liên quan": new Set(events.map((e) => e.code)).size,
        },
      ]);
      await saveStyledReportWorkbook(
        workbook,
        `${filename.replace(/[<>:"/\\|?*]/g, "_").replace(/\.xlsx$/i, "") || "BaoCaoTruyVet"}.xlsx`,
      );
      setExportOpen(false);
    } catch {
      setExportError("Chưa thể xuất báo cáo. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }
  const profileCard = activeProfile && (
    <Panel>
      <p>
        <a
          href="/inventory?screen=INV-01"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở tra cứu tồn ↗
        </a>
      </p>
      <div className="goods-trace-profile-title">
        <span className="goods-trace-symbol">
          <InboxOutlined />
        </span>
        <div>
          <span className="goods-trace-badge">
            {activeProfile.code_type.toUpperCase()}
          </span>
          <h2>{activeProfile.code}</h2>
          <p>
            {text(activeProfile.sku_code)} · {text(activeProfile.sku_name)}
          </p>
        </div>
        {profile && (
          <button onClick={() => setProfile(null)}>← Trở lại kết quả</button>
        )}
      </div>
      <div className="goods-trace-current">
        {[
          [
            "Trạng thái hiện tại",
            enumLabelOrText(ITEM_STATUS_LABELS, activeProfile.current_status) ||
              empty,
          ],
          ["Vị trí hiện tại", text(activeProfile.current_location)],
          [
            "Số lượng trong kho",
            `${number(activeProfile.current_quantity)} ${activeProfile.unit || ""}`,
          ],
          ["Nguồn chứng từ", text(activeProfile.current_source_no)],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="goods-trace-note">
        Trạng thái hiện tại tại {time(data?.data_as_of ?? "")}; độc lập với lịch
        sử trong kỳ.
      </p>
    </Panel>
  );
  const relations =
    data?.relations.filter(
      (r) =>
        !activeProfile ||
        r.parent_code === activeProfile.code ||
        r.child_code === activeProfile.code,
    ) ?? [];
  return (
    <div className="goods-trace-report">
      <header className="goods-trace-header">
        <h1>Báo cáo Truy vết hàng hóa</h1>
        <div>
          <small>Cập nhật: {time(data?.data_as_of ?? "")}</small>
          <button
            className="goods-trace-primary"
            disabled={
              !canExport ||
              !complete ||
              !rows.length ||
              result.isError ||
              result.isFetching
            }
            onClick={() => {
              setExportStock(stockOnly);
              setExportOpen(true);
            }}
          >
            ⇩ Xuất Excel
          </button>
        </div>
      </header>
      <div className="goods-trace-filters">
        <input
          ref={input}
          aria-label="Mã cần truy vết"
          placeholder="Tìm serial, mã BOX, TRAY, chứng từ hoặc SKU"
          value={query.code ?? ""}
          onChange={(e) => update({ code: e.target.value || undefined })}
        />
        <select
          aria-label="Loại mã"
          value={query.code_type}
          onChange={(e) =>
            update({
              code_type: e.target.value as GoodsTraceQuery["code_type"],
            })
          }
        >
          {codeTypes.map(([value, label]) => (
            <option key={value} value={value}>
              Loại mã: {label}
            </option>
          ))}
        </select>
        <ReportDateRangePicker
          value={
            query.from_date && query.to_date
              ? [dayjs(query.from_date), dayjs(query.to_date)]
              : null
          }
          onChange={(range) =>
            update({
              from_date: range?.[0]?.format("YYYY-MM-DD"),
              to_date: range?.[1]?.format("YYYY-MM-DD"),
            })
          }
        />
        <select
          aria-label="Loại hoạt động"
          value={query.activity_type ?? ""}
          onChange={(e) =>
            update({ activity_type: e.target.value || undefined })
          }
        >
          <option value="">Hoạt động: Tất cả</option>
          {Array.from(
            new Map(
              allEvents.map((e) => [e.event_type, e.event_label]),
            ).entries(),
          ).map(([value, label]) => (
            <option key={value} value={value}>
              Hoạt động: {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Nguồn chứng từ"
          value={query.source ?? ""}
          onChange={(e) => update({ source: e.target.value || undefined })}
        >
          <option value="">Nguồn: Tất cả</option>
          {Array.from(
            new Set(allEvents.map((e) => e.source_type).filter(Boolean)),
          ).map((value) => (
            <option key={value} value={value}>
              Nguồn: {sourceLabel(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Người thực hiện"
          value={query.actor ?? ""}
          onChange={(e) => update({ actor: e.target.value || undefined })}
        >
          <option value="">Người thực hiện: Tất cả</option>
          {Array.from(
            new Set(allEvents.map((e) => e.actor).filter(Boolean)),
          ).map((value) => (
            <option key={value} value={value}>
              Người thực hiện: {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Quan hệ"
          value={query.relation ?? "all"}
          onChange={(e) =>
            update({ relation: e.target.value as GoodsTraceQuery["relation"] })
          }
        >
          <option value="all">Quan hệ: Tất cả</option>
          <option value="original">Quan hệ: Bút toán gốc</option>
          <option value="reversal">Quan hệ: Bút toán đảo</option>
        </select>
        {filtered && <button onClick={reset}>Xóa lọc</button>}
      </div>
      {result.isPending || result.isFetching ? (
        <Panel>
          <div role="status" className="goods-trace-empty">
            Đang tải lịch sử truy vết…
          </div>
        </Panel>
      ) : (
        <>
          {data && !complete && (
            <div role="alert" className="goods-trace-warning">
              <div>
                <strong>Lịch sử chưa đầy đủ</strong>
                <p>
                  Đã tải {data.loaded_count}/{data.total_count} sự kiện. Chưa
                  thể tính do lịch sử chưa đầy đủ.
                </p>
              </div>
              <button onClick={() => void result.refetch()}>
                Tải lại phần còn thiếu
              </button>
            </div>
          )}
          {data?.warnings.map((warning, i) => (
            <p role="status" className="goods-trace-warning" key={i}>
              {warning}
            </p>
          ))}
          {profileCard}
          <div className="goods-trace-kpis">
            {[
              [
                "Sự kiện",
                result.isError
                  ? empty
                  : `${profileEvents.length}${!complete && data ? ` / ${data.total_count}` : ""}`,
                "Tổng số sự kiện trong khoảng thời gian.",
              ],
              [
                "Mã liên quan",
                result.isError ? empty : codes,
                "Số mã hàng có sự kiện trong kết quả.",
              ],
              [
                "Tác động tồn",
                result.isError ? empty : stockCount,
                "Số sự kiện làm thay đổi tồn kho.",
              ],
              [
                "Ảnh hưởng thuần",
                complete && !result.isError ? delta(net) : empty,
                complete
                  ? net == null
                    ? "Chưa xác định biến động theo mã; xem sổ kho nguồn trong chi tiết."
                    : "Chênh lệch tồn kho sau cùng trong kỳ."
                  : "Chưa thể tính do lịch sử chưa đầy đủ.",
              ],
            ].map(([label, value, description], i) => (
              <Panel key={String(label)}>
                <span className={`goods-trace-symbol tone-${i}`}>
                  {
                    [
                      <FileTextOutlined key="events" />,
                      <InboxOutlined key="codes" />,
                      <StockOutlined key="stock" />,
                      <BarChartOutlined key="net" />,
                    ][i]
                  }
                </span>
                <div>
                  <small>{label}</small>
                  <strong>{value}</strong>
                  <p>{description}</p>
                </div>
              </Panel>
            ))}
          </div>
          <div className="goods-trace-layout">
            <div className="goods-trace-main">
              <Panel>
                <div className="goods-trace-section-heading">
                  <h2>
                    {activeProfile &&
                    ["box", "tray"].includes(
                      activeProfile.code_type.toLowerCase(),
                    )
                      ? "Dấu vết vị trí"
                      : `Lịch sử truy vết (${rows.length} sự kiện)`}
                  </h2>
                  <label className="goods-trace-toggle">
                    <input
                      type="checkbox"
                      checked={stockOnly}
                      onChange={(e) => {
                        setStockOnly(e.target.checked);
                        setPage(1);
                      }}
                    />
                    Chỉ sự kiện tác động tồn
                  </label>
                </div>
                {activeProfile && (
                  <div
                    className="goods-trace-tabs"
                    role="tablist"
                    aria-label="Hồ sơ mã"
                  >
                    {[
                      ["timeline", "Dòng thời gian"],
                      ["documents", "Chứng từ liên quan"],
                      ["packing", "Vị trí & đóng gói"],
                    ].map(([value, label]) => (
                      <button
                        role="tab"
                        aria-selected={tab === value}
                        key={value}
                        onClick={() => setTab(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {result.isError ? (
                  <div role="alert" className="goods-trace-empty">
                    <span className="goods-trace-symbol">
                      <WarningOutlined />
                    </span>
                    <h2>Chưa thể tải lịch sử truy vết</h2>
                    <p>Bộ lọc của bạn được giữ nguyên. Vui lòng thử lại.</p>
                    <button
                      className="goods-trace-primary"
                      onClick={() => void result.refetch()}
                    >
                      Thử lại
                    </button>
                    <button onClick={reset}>Đặt lại bộ lọc</button>
                  </div>
                ) : !rows.length ? (
                  <div className="goods-trace-empty">
                    <span className="goods-trace-symbol">
                      <SearchOutlined />
                    </span>
                    <h2>
                      {data?.resolved === false
                        ? "Không tìm thấy mã trong phạm vi được phép"
                        : data?.resolved === true
                          ? "Chưa có sự kiện trong khoảng thời gian đã chọn"
                          : "Chưa có sự kiện phù hợp"}
                    </h2>
                    <p>
                      {data?.resolved === false
                        ? "Kiểm tra ký tự hoặc thay đổi loại mã."
                        : "Không có sự kiện phù hợp với bộ lọc hiện tại. Lịch sử trong kỳ không thay thế trạng thái hiện tại."}
                    </p>
                    <button
                      className="goods-trace-primary"
                      onClick={
                        data?.resolved === false
                          ? () => input.current?.focus()
                          : expand
                      }
                    >
                      {data?.resolved === false
                        ? "Nhập lại mã"
                        : "Mở rộng thời gian"}
                    </button>
                    {data?.entities[0] && (
                      <button
                        onClick={() => {
                          setProfile(data.entities[0]);
                          setTab("timeline");
                        }}
                      >
                        Mở hồ sơ mã
                      </button>
                    )}
                  </div>
                ) : activeProfile && tab === "packing" ? (
                  <>
                    <Facts
                      rows={[
                        ["Mã cha", text(activeProfile.parent_code)],
                        ["Loại mã cha", text(activeProfile.parent_type)],
                        [
                          "Vị trí hiện tại",
                          text(activeProfile.current_location),
                        ],
                      ]}
                    />
                    {relations.length ? (
                      relations.map((r, i) => (
                        <div className="goods-trace-relation" key={i}>
                          <strong>
                            {r.parent_code} → {r.child_code}
                          </strong>
                          <span>
                            {r.sku_code} · {number(r.quantity)} ·{" "}
                            {text(r.location)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>Chưa có thông tin quan hệ đóng gói.</p>
                    )}
                    <p className="goods-trace-note">
                      Xếp khay chỉ thay đổi vị trí, không tự tạo nhập/xuất tồn.
                    </p>
                  </>
                ) : activeProfile && tab === "documents" ? (
                  <div className="goods-trace-documents">
                    {Array.from(
                      new Map(
                        profileEvents
                          .flatMap((e) => [
                            e,
                            ...e.related_documents.map((d) => ({
                              ...e,
                              source_id: d.id,
                              source_no: d.code,
                              source_type: d.type,
                            })),
                          ])
                          .filter((e) => e.source_id)
                          .map((e) => [e.source_id, e]),
                      ).values(),
                    ).map((e) => (
                      <button key={e.source_id} onClick={() => openSource(e)}>
                        <strong>{text(e.source_no)}</strong>
                        <span>
                          {e.event_label} · {time(e.occurred_at)} →
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="goods-trace-table-scroll">
                      <table>
                        <colgroup>
                          <col style={{ width: "20%" }} />
                          <col style={{ width: "23%" }} />
                          <col style={{ width: "27%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "7%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Thời điểm ↓</th>
                            <th>Mã hàng – SKU</th>
                            <th>Sự kiện – Chứng từ</th>
                            <th>Vị trí</th>
                            <th>Δ tồn</th>
                            <th aria-label="Mở chi tiết" />
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((e) => (
                            <tr
                              key={e.id}
                              {...rowActivationProps(() => setSelected(e))}
                            >
                              <td>{time(e.occurred_at)}</td>
                              <td>
                                <button
                                  className="goods-trace-link"
                                  onClick={() => {
                                    const entity = data?.entities.find(
                                      (x) =>
                                        x.key === e.entity_key ||
                                        x.code === e.code,
                                    );
                                    if (entity) {
                                      setProfile(entity);
                                      setTab("timeline");
                                      setPage(1);
                                    } else setSelected(e);
                                  }}
                                >
                                  {text(e.code)}
                                </button>
                                <small>{text(e.sku_code)}</small>
                              </td>
                              <td>
                                <span
                                  className={`goods-trace-event-dot ${(e.qty_delta ?? 0) > 0 ? "positive" : (e.qty_delta ?? 0) < 0 ? "negative" : "neutral"}`}
                                />
                                {e.event_label}
                                <button
                                  className="goods-trace-link goods-trace-source"
                                  disabled={!e.source_id}
                                  onClick={() => openSource(e)}
                                >
                                  {text(e.source_no)}
                                </button>
                              </td>
                              <td>
                                {text(e.location_before)} →{" "}
                                {text(e.location_after)}
                                <small>Số lượng: {number(e.quantity)}</small>
                              </td>
                              <td
                                className={
                                  (e.qty_delta ?? 0) > 0
                                    ? "positive"
                                    : (e.qty_delta ?? 0) < 0
                                      ? "negative"
                                      : ""
                                }
                              >
                                {delta(e.qty_delta)}
                              </td>
                              <td>
                                <button
                                  className="goods-trace-arrow"
                                  aria-label={`Chi tiết sự kiện ${e.code} ${e.event_label}`}
                                  onClick={() => setSelected(e)}
                                >
                                  →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <footer className="goods-trace-pagination">
                      <div>
                        Hiển thị {(page - 1) * pageSize + 1}–
                        {Math.min(page * pageSize, rows.length)} / {rows.length}{" "}
                        sự kiện{" "}
                        <UiSelect
                          aria-label="Số dòng mỗi trang"
                          value={pageSize}
                          minWidth={FILTER_WIDTH.pageSize}
                          options={[10, 25, 50].map((n) => ({
                            value: n,
                            label: `${n} / trang`,
                          }))}
                          onChange={(value) => {
                            setPageSize(Number(value));
                            setPage(1);
                          }}
                        />
                      </div>
                      <div>
                        <button
                          aria-label="Trang trước"
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          ‹
                        </button>
                        <span>{page}</span>
                        <button
                          aria-label="Trang sau"
                          disabled={page * pageSize >= rows.length}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          ›
                        </button>
                      </div>
                    </footer>
                  </>
                )}
              </Panel>
            </div>
            <aside>
              <Panel
                title={
                  activeProfile &&
                  ["box", "tray"].includes(
                    activeProfile.code_type.toLowerCase(),
                  )
                    ? "Quan hệ BOX – TRAY"
                    : "Đọc đúng dấu vết"
                }
              >
                {activeProfile &&
                ["box", "tray"].includes(
                  activeProfile.code_type.toLowerCase(),
                ) ? (
                  <>
                    <p className="goods-trace-note">
                      Đang xem {activeProfile.code_type.toUpperCase()} được
                      chọn; quan hệ trong phạm vi dữ liệu được phép.
                    </p>
                    {relations.map((r, i) => (
                      <div className="goods-trace-relation" key={i}>
                        <strong>
                          {r.parent_code} → {r.child_code}
                        </strong>
                        <span>
                          {r.sku_code} · {number(r.quantity)} ·{" "}
                          {text(r.location)}
                        </span>
                      </div>
                    ))}
                    {!relations.length && (
                      <p>Chưa có thông tin quan hệ đóng gói.</p>
                    )}
                  </>
                ) : (
                  <>
                    <Facts
                      rows={[
                        ["Sự kiện tác động tồn", stockCount],
                        [
                          "Sự kiện không đổi tồn",
                          profileEvents.length - stockCount,
                        ],
                        ["Mã liên quan", codes],
                      ]}
                    />
                    <p className="goods-trace-note">
                      In nhãn, xếp khay và tiếp nhận bảo hành không tự làm thay
                      đổi tồn kho. Lịch sử trong kỳ không thay thế số dư đầu kỳ.
                    </p>
                    {data?.resolved === false && (
                      <p>
                        Nhập serial, mã BOX, TRAY hoặc chứng từ; chọn loại mã và
                        khoảng ngày để thu hẹp kết quả.
                      </p>
                    )}
                  </>
                )}
              </Panel>
              <Panel title="Thông tin truy vấn">{queryInfo}</Panel>
            </aside>
          </div>
        </>
      )}
      <Drawer
        anchor="right"
        open={Boolean(selected)}
        ModalProps={{ disableEnforceFocus: Boolean(source || sourceTrace) }}
        onClose={() => setSelected(null)}
        slotProps={{ paper: { className: "goods-trace-drawer" } }}
      >
        {selected && (
          <div className="goods-trace-report">
            <div className="goods-trace-section-heading">
              <h2>Chi tiết sự kiện</h2>
              <button
                aria-label="Đóng chi tiết sự kiện"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>
            <Panel title="Thông tin mã hàng / thiết bị">
              <h2>
                {text(selected.code)} / {text(selected.sku_code)}
              </h2>
              <p>{text(selected.sku_name)}</p>
              <span className="goods-trace-badge">
                {enumLabelOrText(MOVEMENT_STATUS_LABELS, selected.status) ||
                  empty}
              </span>
              <h3>{selected.event_label}</h3>
              <div className="goods-trace-current">
                <div>
                  <small>Tồn trước → Tồn sau</small>
                  <strong>
                    {number(selected.qty_before)} → {number(selected.qty_after)}
                  </strong>
                </div>
                <div>
                  <small>Biến động</small>
                  <strong>{delta(selected.qty_delta)}</strong>
                </div>
              </div>
              <p className="goods-trace-note">
                Số dư và biến động theo mã đang xem; số liệu chưa xác định hiển
                thị —. Biến động sổ kho nguồn là số lượng theo SKU.
              </p>
              <Facts
                rows={[
                  ["Thời điểm nghiệp vụ", time(selected.occurred_at)],
                  ["Thời điểm ghi nhận", time(selected.recorded_at)],
                  ["Thời điểm dữ liệu", time(data?.data_as_of ?? "")],
                  ["Người ghi sổ", text(selected.actor)],
                  ["Kho", text(selected.warehouse_code)],
                  ["Vị trí trước", text(selected.location_before)],
                  ["Vị trí sau", text(selected.location_after)],
                ]}
              />
            </Panel>
            <Panel title="Nguồn chứng từ">
              <h3>{text(selected.source_no)}</h3>
              <Facts
                rows={[
                  [
                    "Tổng số lượng trên phiếu",
                    number(selected.source_quantity),
                  ],
                  ["Số lượng mã đang xem", number(selected.entity_quantity)],
                  [
                    "Biến động sổ kho nguồn (SKU)",
                    delta(selected.source_qty_delta),
                  ],
                ]}
              />
              <button
                disabled={!selected.source_id}
                className="goods-trace-primary"
                onClick={() => openSource(selected)}
              >
                Mở chứng từ nguồn
              </button>
            </Panel>
            <Panel title="Chứng từ liên quan">
              {selected.related_documents.length ? (
                selected.related_documents.map((d) => (
                  <button
                    className="goods-trace-link"
                    key={d.id}
                    onClick={() =>
                      openSource({
                        ...selected,
                        source_id: d.id,
                        source_no: d.code,
                        source_type: d.type,
                      })
                    }
                  >
                    {d.code} →
                  </button>
                ))
              ) : (
                <p>Chưa có chứng từ liên quan.</p>
              )}
            </Panel>
          </div>
        )}
      </Drawer>
      {source && (
        <FlowDocumentDetailModal
          document={{
            id: source.source_id,
            document_no: source.source_no,
            doc_type: [
              "INBOUND",
              "INBOUND_DOCUMENT",
              "RECEIPT_DOCUMENT",
            ].includes(source.source_type.toUpperCase())
              ? "INBOUND"
              : "OUTBOUND",
            status: source.status,
            warehouse_code: source.warehouse_code,
            counterpart: "",
            created_by_name: source.actor,
            posted_at: source.recorded_at,
            document_date: source.occurred_at,
            drillKey: source.sku_code,
          }}
          onClose={() => setSource(null)}
        />
      )}
      {sourceTrace &&
        (sourceTrace.source_type.toUpperCase().includes("REVERSAL") ? (
          <ReversalDetailModal
            documentId={sourceTrace.source_id}
            onClose={() => setSourceTrace(null)}
          />
        ) : (
          <Drawer
            anchor="right"
            open
            onClose={() => setSourceTrace(null)}
            slotProps={{ paper: { className: "goods-trace-drawer" } }}
          >
            <div className="goods-trace-report">
              <div className="goods-trace-section-heading">
                <h2>Thông tin chứng từ nguồn</h2>
                <button
                  aria-label="Đóng thông tin nguồn"
                  onClick={() => setSourceTrace(null)}
                >
                  ×
                </button>
              </div>
              <Panel title={sourceTrace.source_no}>
                <Facts
                  rows={[
                    ["Loại chứng từ", sourceLabel(sourceTrace.source_type)],
                    ["Sự kiện", sourceTrace.event_label],
                    ["Thời điểm", time(sourceTrace.occurred_at)],
                    ["Người thực hiện", text(sourceTrace.actor)],
                    ["Số lượng nguồn", number(sourceTrace.source_quantity)],
                    ["Mã hàng", text(sourceTrace.code)],
                    ["Vị trí trước", text(sourceTrace.location_before)],
                    ["Vị trí sau", text(sourceTrace.location_after)],
                  ]}
                />
                <p className="goods-trace-note">
                  Thông tin nguồn được ghi nhận trong lịch sử truy vết.
                </p>
                {goodsTraceSourcePath(
                  sourceTrace.source_type,
                  sourceTrace.source_id,
                ) && (
                  <p>
                    <a
                      href={goodsTraceSourcePath(
                        sourceTrace.source_type,
                        sourceTrace.source_id,
                      )!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Mở chứng từ nguồn ↗
                    </a>
                  </p>
                )}
              </Panel>
            </div>
          </Drawer>
        ))}
      {exportOpen && (
        <DrillDownModal
          titleId="goods-trace-export-title"
          className="goods-trace-export"
          onClose={() => setExportOpen(false)}
        >
          <div className="goods-trace-report">
            <div className="goods-trace-section-heading">
              <h2 id="goods-trace-export-title">Xuất báo cáo truy vết</h2>
              <button
                className="modal-close"
                aria-label="Đóng xuất báo cáo"
                onClick={() => setExportOpen(false)}
              >
                ×
              </button>
            </div>
            <p>Giữ nguyên bộ lọc và phạm vi truy vết.</p>
            <fieldset>
              <legend>Phạm vi xuất</legend>
              <label>
                <input
                  type="radio"
                  name="exportScope"
                  checked={!exportStock}
                  onChange={() => setExportStock(false)}
                />
                Toàn bộ kết quả đang hiển thị ({rows.length} sự kiện)
              </label>
              <label>
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportStock}
                  onChange={() => setExportStock(true)}
                />
                Chỉ sự kiện tác động tồn ({rows.filter(isStockEvent).length} sự
                kiện)
              </label>
            </fieldset>
            <div className="goods-trace-export-grid">
              <Panel title="Thông tin truy vấn">{queryInfo}</Panel>
              <Panel title="Nội dung xuất">
                {(
                  [
                    ["events", "Danh sách sự kiện"],
                    ["documents", "Liên kết chứng từ"],
                    ["relations", "Quan hệ BOX – TRAY"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={sections[key]}
                      onChange={(e) =>
                        setSections((s) => ({ ...s, [key]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </Panel>
            </div>
            <Panel title="Tóm tắt kết quả xuất">
              <Facts
                rows={[
                  [
                    "Sự kiện",
                    rows.filter((e) => !exportStock || isStockEvent(e)).length,
                  ],
                  ["Tác động tồn", rows.filter(isStockEvent).length],
                  [
                    "Ảnh hưởng thuần",
                    complete
                      ? delta(
                          netDelta(
                            rows.filter((e) => !exportStock || isStockEvent(e)),
                          ),
                        )
                      : empty,
                  ],
                ]}
              />
            </Panel>
            <p className="goods-trace-note">
              Chỉ xuất dữ liệu trong phạm vi quyền truy cập và bộ lọc hiện tại.
            </p>
            <label>
              Tên file
              <input
                aria-label="Tên file"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </label>
            <p>Định dạng: Excel (.xlsx)</p>
            {exportError && <p role="alert">{exportError}</p>}
            <footer>
              <button
                className="goods-trace-cancel"
                onClick={() => setExportOpen(false)}
              >
                Hủy
              </button>
              <button
                className="goods-trace-primary"
                disabled={
                  exporting ||
                  !Object.values(sections).some(Boolean) ||
                  !canExport ||
                  !complete ||
                  result.isFetching
                }
                onClick={() => void exportFile()}
              >
                {exporting ? "Đang xuất…" : "Xuất Excel"}
              </button>
            </footer>
          </div>
        </DrillDownModal>
      )}
    </div>
  );
}

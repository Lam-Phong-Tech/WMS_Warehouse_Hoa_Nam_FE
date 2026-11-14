import { useT } from "@/shared/i18n/useT";
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
  const tUi = useT();
  const sourceLabels = {
    ...SOURCE_DOCUMENT_TYPE_LABELS,
    INBOUND: tUi("goodsTraceAudit.inboundDocument"),
    INBOUND_DOCUMENT: tUi("goodsTraceAudit.inboundDocument"),
    OUTBOUND: tUi("goodsTraceAudit.outboundDocument"),
    OUTBOUND_DOCUMENT: tUi("goodsTraceAudit.outboundDocument"),
    PUTAWAY: tUi("goodsTraceAudit.putawayDocument"),
    LABEL: tUi("goodsTraceAudit.labelPrinting"),
    WARRANTY: tUi("goodsTraceAudit.warranty"),
    REVERSAL_DOCUMENT: tUi("goodsTraceAudit.reversalDocument"),
    RECEIPT_DOCUMENT: tUi("goodsTraceAudit.inboundDocument"),
    ISSUE_DOCUMENT: tUi("goodsTraceAudit.outboundDocument"),
    LABEL_PRINT: tUi("goodsTraceAudit.labelPrinting"),
  };
  const sourceLabel = (value: string) =>
    enumLabelOrText(sourceLabels, value) || "—";
  const codeTypes = [
    ["all", tUi("goodsTraceAudit.all")],
    ["serial", tUi("nfc.serial")],
    ["box", "BOX"],
    ["tray", "TRAY"],
    ["document", tUi("goodsTraceAudit.document")],
    ["sku", "SKU"],
  ];

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
        [
          tUi("goodsTraceAudit.traceCode"),
          text(activeProfile?.code || query.code),
        ],
        [
          tUi("goodsTraceAudit.codeType"),
          codeTypes.find((x) => x[0] === query.code_type)?.[1] ??
            tUi("goodsTraceAudit.all"),
        ],
        [
          tUi("goodsTraceAudit.dateRange"),
          `${query.from_date ? dayjs(query.from_date).format("DD/MM/YYYY") : tUi("goodsTraceAudit.all")} – ${query.to_date ? dayjs(query.to_date).format("DD/MM/YYYY") : tUi("goodsTraceAudit.all")}`,
        ],
        [
          tUi("goodsTraceAudit.activityType"),
          query.activity_type || tUi("goodsTraceAudit.all"),
        ],
        [tUi("goodsTraceAudit.updatedAt"), time(data?.data_as_of ?? "")],
        [tUi("goodsTraceAudit.dataSource"), tUi("goodsTraceAudit.systemData")],
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
      setExportError(tUi("goodsTraceAudit.exportError"));
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
          {tUi("uiAudit.text_eafb525542")}{" "}
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
          <button onClick={() => setProfile(null)}>
            {tUi("uiAudit.text_d204b5a47f")}
          </button>
        )}
      </div>
      <div className="goods-trace-current">
        {[
          [
            tUi("goodsTraceAudit.currentStatus"),
            enumLabelOrText(ITEM_STATUS_LABELS, activeProfile.current_status) ||
              empty,
          ],
          [
            tUi("goodsTraceAudit.currentLocation"),
            text(activeProfile.current_location),
          ],
          [
            tUi("goodsTraceAudit.stockQuantity"),
            `${number(activeProfile.current_quantity)} ${activeProfile.unit || ""}`,
          ],
          [
            tUi("goodsTraceAudit.sourceDocument"),
            text(activeProfile.current_source_no),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="goods-trace-note">
        {tUi("uiAudit.text_a33e9e8dde")} {time(data?.data_as_of ?? "")}
        {tUi("uiAudit.text_6297a32d85")}{" "}
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
        <h1>{tUi("reports.traceability.title")}</h1>
        <div>
          <small>
            {tUi("uiAudit.text_1f2d4d35a3")} {time(data?.data_as_of ?? "")}
          </small>
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
            {tUi("uiAudit.text_1a619d4396")}{" "}
          </button>
        </div>
      </header>
      <div className="goods-trace-filters">
        <input
          ref={input}
          aria-label={tUi("uiAudit.text_de41a17406")}
          placeholder={tUi("uiAudit.text_fa6e926d5a")}
          value={query.code ?? ""}
          onChange={(e) => update({ code: e.target.value || undefined })}
        />
        <select
          aria-label={tUi("inventory.trace.fieldCodeType")}
          value={query.code_type}
          onChange={(e) =>
            update({
              code_type: e.target.value as GoodsTraceQuery["code_type"],
            })
          }
        >
          {codeTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {tUi("uiAudit.text_3417fec764")} {label}
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
          aria-label={tUi("uiAudit.text_55cb99d3e5")}
          value={query.activity_type ?? ""}
          onChange={(e) =>
            update({ activity_type: e.target.value || undefined })
          }
        >
          <option value="">{tUi("uiAudit.text_ab28eea9c3")}</option>
          {Array.from(
            new Map(
              allEvents.map((e) => [e.event_type, e.event_label]),
            ).entries(),
          ).map(([value, label]) => (
            <option key={value} value={value}>
              {tUi("uiAudit.text_beed899a22")} {label}
            </option>
          ))}
        </select>
        <select
          aria-label={tUi("uiAudit.text_843900338f")}
          value={query.source ?? ""}
          onChange={(e) => update({ source: e.target.value || undefined })}
        >
          <option value="">{tUi("uiAudit.text_d4767ab8d5")}</option>
          {Array.from(
            new Set(allEvents.map((e) => e.source_type).filter(Boolean)),
          ).map((value) => (
            <option key={value} value={value}>
              {tUi("uiAudit.text_dcd2b5f785")} {sourceLabel(value)}
            </option>
          ))}
        </select>
        <select
          aria-label={tUi("packingLabelReport.operator")}
          value={query.actor ?? ""}
          onChange={(e) => update({ actor: e.target.value || undefined })}
        >
          <option value="">{tUi("uiAudit.text_0d63458be8")}</option>
          {Array.from(
            new Set(allEvents.map((e) => e.actor).filter(Boolean)),
          ).map((value) => (
            <option key={value} value={value}>
              {tUi("uiAudit.text_f7aaa4d291")} {value}
            </option>
          ))}
        </select>
        <select
          aria-label={tUi("reports.movementTrace.relation")}
          value={query.relation ?? "all"}
          onChange={(e) =>
            update({ relation: e.target.value as GoodsTraceQuery["relation"] })
          }
        >
          <option value="all">{tUi("uiAudit.text_fcc88705d6")}</option>
          <option value="original">{tUi("uiAudit.text_f9b9712862")}</option>
          <option value="reversal">{tUi("uiAudit.text_d34baeafc8")}</option>
        </select>
        {filtered && (
          <button onClick={reset}>{tUi("dashboardAudit.clearFilters")}</button>
        )}
      </div>
      {result.isPending || result.isFetching ? (
        <Panel>
          <div role="status" className="goods-trace-empty">
            {tUi("uiAudit.text_4916506f3d")}{" "}
          </div>
        </Panel>
      ) : (
        <>
          {data && !complete && (
            <div role="alert" className="goods-trace-warning">
              <div>
                <strong>{tUi("uiAudit.text_cf4c899fdf")}</strong>
                <p>
                  {tUi("uiAudit.text_2a039e56cb")} {data.loaded_count}/
                  {data.total_count} {tUi("uiAudit.text_6c0f233318")}{" "}
                </p>
              </div>
              <button onClick={() => void result.refetch()}>
                {tUi("uiAudit.text_4e21fb52a0")}{" "}
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
                tUi("goodsTraceAudit.events"),
                result.isError
                  ? empty
                  : `${profileEvents.length}${!complete && data ? ` / ${data.total_count}` : ""}`,
                tUi("goodsTraceAudit.eventCountHint"),
              ],
              [
                tUi("goodsTraceAudit.relatedCodes"),
                result.isError ? empty : codes,
                tUi("goodsTraceAudit.relatedCodesHint"),
              ],
              [
                tUi("goodsTraceAudit.stockImpact"),
                result.isError ? empty : stockCount,
                tUi("goodsTraceAudit.stockImpactHint"),
              ],
              [
                tUi("goodsTraceAudit.netImpact"),
                complete && !result.isError ? delta(net) : empty,
                complete
                  ? net == null
                    ? tUi("goodsTraceAudit.unknownCodeMovement")
                    : tUi("goodsTraceAudit.netImpactHint")
                  : tUi("goodsTraceAudit.incompleteHistory"),
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
                      ? tUi("goodsTraceAudit.locationHistory")
                      : tUi("goodsTraceAudit.historyTitle", {
                          count: rows.length,
                        })}
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
                    {tUi("uiAudit.text_2051b8acd9")}{" "}
                  </label>
                </div>
                {activeProfile && (
                  <div
                    className="goods-trace-tabs"
                    role="tablist"
                    aria-label={tUi("uiAudit.text_0ec742814e")}
                  >
                    {[
                      ["timeline", tUi("goodsTraceAudit.timeline")],
                      ["documents", tUi("goodsTraceAudit.relatedDocuments")],
                      ["packing", tUi("goodsTraceAudit.locationPacking")],
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
                    <h2>{tUi("uiAudit.text_d05006dd97")}</h2>
                    <p>{tUi("uiAudit.text_12a85f5ae7")}</p>
                    <button
                      className="goods-trace-primary"
                      onClick={() => void result.refetch()}
                    >
                      {tUi("dashboardAudit.retry")}{" "}
                    </button>
                    <button onClick={reset}>
                      {tUi("updatedUi.text_49ced19e7f1d")}
                    </button>
                  </div>
                ) : !rows.length ? (
                  <div className="goods-trace-empty">
                    <span className="goods-trace-symbol">
                      <SearchOutlined />
                    </span>
                    <h2>
                      {data?.resolved === false
                        ? tUi("goodsTraceAudit.codeNotFound")
                        : data?.resolved === true
                          ? tUi("goodsTraceAudit.noPeriodEvents")
                          : tUi("goodsTraceAudit.noMatchingEvents")}
                    </h2>
                    <p>
                      {data?.resolved === false
                        ? tUi("goodsTraceAudit.checkCode")
                        : tUi("goodsTraceAudit.noMatchingEventsHint")}
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
                        ? tUi("goodsTraceAudit.reenterCode")
                        : tUi("goodsTraceAudit.expandPeriod")}
                    </button>
                    {data?.entities[0] && (
                      <button
                        onClick={() => {
                          setProfile(data.entities[0]);
                          setTab("timeline");
                        }}
                      >
                        {tUi("uiAudit.text_6464f3cfee")}{" "}
                      </button>
                    )}
                  </div>
                ) : activeProfile && tab === "packing" ? (
                  <>
                    <Facts
                      rows={[
                        [
                          tUi("goodsTraceAudit.parentCode"),
                          text(activeProfile.parent_code),
                        ],
                        [
                          tUi("goodsTraceAudit.parentCodeType"),
                          text(activeProfile.parent_type),
                        ],
                        [
                          tUi("goodsTraceAudit.currentLocation"),
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
                      <p>{tUi("uiAudit.text_7706e42b7e")}</p>
                    )}
                    <p className="goods-trace-note">
                      {tUi("uiAudit.text_0bf4fd5247")}{" "}
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
                            <th>{tUi("uiAudit.text_5832331aa5")}</th>
                            <th>{tUi("uiAudit.text_2dcb4a61ef")}</th>
                            <th>{tUi("uiAudit.text_5a2201ba98")}</th>
                            <th>
                              {tUi("inventory.balance.colSuggestedLocation")}
                            </th>
                            <th>{tUi("uiAudit.text_f96e5063a1")}</th>
                            <th aria-label={tUi("uiAudit.text_8bcb230922")} />
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
                                <small>
                                  {tUi("uiAudit.text_0433ae9901")}{" "}
                                  {number(e.quantity)}
                                </small>
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
                                  aria-label={tUi(
                                    "goodsTraceAudit.eventDetailsAria",
                                    { code: e.code, event: e.event_label },
                                  )}
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
                        {tUi("dashboardAudit.showing")}{" "}
                        {(page - 1) * pageSize + 1}–
                        {Math.min(page * pageSize, rows.length)} / {rows.length}{" "}
                        {tUi("uiAudit.text_d167eae269")}{" "}
                        <UiSelect
                          kind="page-size"
                          aria-label={tUi("dashboardAudit.pageSize")}
                          value={pageSize}
                          minWidth={FILTER_WIDTH.pageSize}
                          options={[10, 25, 50].map((n) => ({
                            value: n,
                            label: tUi("shared.table.perPage", { size: n }),
                          }))}
                          onChange={(value) => {
                            setPageSize(Number(value));
                            setPage(1);
                          }}
                        />
                      </div>
                      <div>
                        <button
                          aria-label={tUi("packingLabelReport.previousPage")}
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          ‹
                        </button>
                        <span>{page}</span>
                        <button
                          aria-label={tUi("goodsTraceAudit.nextPage")}
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
                    ? tUi("goodsTraceAudit.boxTrayRelations")
                    : tUi("goodsTraceAudit.readingHistory")
                }
              >
                {activeProfile &&
                ["box", "tray"].includes(
                  activeProfile.code_type.toLowerCase(),
                ) ? (
                  <>
                    <p className="goods-trace-note">
                      {tUi("uiAudit.text_22e44ee558")}{" "}
                      {activeProfile.code_type.toUpperCase()}{" "}
                      {tUi("uiAudit.text_74c012f92e")}{" "}
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
                      <p>{tUi("uiAudit.text_7706e42b7e")}</p>
                    )}
                  </>
                ) : (
                  <>
                    <Facts
                      rows={[
                        [tUi("goodsTraceAudit.stockEvents"), stockCount],
                        [
                          tUi("goodsTraceAudit.nonStockEvents"),
                          profileEvents.length - stockCount,
                        ],
                        [tUi("goodsTraceAudit.relatedCodes"), codes],
                      ]}
                    />
                    <p className="goods-trace-note">
                      {tUi("uiAudit.text_bbafb09655")}{" "}
                    </p>
                    {data?.resolved === false && (
                      <p>{tUi("uiAudit.text_78351a6c7a")} </p>
                    )}
                  </>
                )}
              </Panel>
              <Panel title={tUi("uiAudit.text_8de8564851")}>{queryInfo}</Panel>
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
              <h2>{tUi("uiAudit.text_764eeb6c55")}</h2>
              <button
                aria-label={tUi("uiAudit.text_18b9dbf700")}
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>
            <Panel title={tUi("uiAudit.text_28dfc7cb81")}>
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
                  <small>{tUi("uiAudit.text_b20c8a1783")}</small>
                  <strong>
                    {number(selected.qty_before)} → {number(selected.qty_after)}
                  </strong>
                </div>
                <div>
                  <small>{tUi("inventory.detail.movementsTab")}</small>
                  <strong>{delta(selected.qty_delta)}</strong>
                </div>
              </div>
              <p className="goods-trace-note">
                {tUi("uiAudit.text_0f0235e90c")}{" "}
              </p>
              <Facts
                rows={[
                  [
                    tUi("goodsTraceAudit.businessTime"),
                    time(selected.occurred_at),
                  ],
                  [
                    tUi("goodsTraceAudit.recordedAt"),
                    time(selected.recorded_at),
                  ],
                  [
                    tUi("goodsTraceAudit.dataAsOf"),
                    time(data?.data_as_of ?? ""),
                  ],
                  [tUi("goodsTraceAudit.postedBy"), text(selected.actor)],
                  [
                    tUi("goodsTraceAudit.warehouse"),
                    text(selected.warehouse_code),
                  ],
                  [
                    tUi("goodsTraceAudit.locationBefore"),
                    text(selected.location_before),
                  ],
                  [
                    tUi("goodsTraceAudit.locationAfter"),
                    text(selected.location_after),
                  ],
                ]}
              />
            </Panel>
            <Panel title={tUi("uiAudit.text_843900338f")}>
              <h3>{text(selected.source_no)}</h3>
              <Facts
                rows={[
                  [
                    tUi("goodsTraceAudit.documentQuantity"),
                    number(selected.source_quantity),
                  ],
                  [
                    tUi("goodsTraceAudit.codeQuantity"),
                    number(selected.entity_quantity),
                  ],
                  [
                    tUi("goodsTraceAudit.sourceLedgerMovement"),
                    delta(selected.source_qty_delta),
                  ],
                ]}
              />
              <button
                disabled={!selected.source_id}
                className="goods-trace-primary"
                onClick={() => openSource(selected)}
              >
                {tUi("uiAudit.text_533327bb2f")}{" "}
              </button>
            </Panel>
            <Panel title={tUi("uiAudit.text_e905e60169")}>
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
                <p>{tUi("uiAudit.text_8c6aea7580")}</p>
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
                <h2>{tUi("uiAudit.text_375353f3a4")}</h2>
                <button
                  aria-label={tUi("uiAudit.text_4125f99c97")}
                  onClick={() => setSourceTrace(null)}
                >
                  ×
                </button>
              </div>
              <Panel title={sourceTrace.source_no}>
                <Facts
                  rows={[
                    [
                      tUi("goodsTraceAudit.documentType"),
                      sourceLabel(sourceTrace.source_type),
                    ],
                    [tUi("goodsTraceAudit.events"), sourceTrace.event_label],
                    [
                      tUi("goodsTraceAudit.eventTime"),
                      time(sourceTrace.occurred_at),
                    ],
                    [tUi("goodsTraceAudit.actor"), text(sourceTrace.actor)],
                    [
                      tUi("goodsTraceAudit.sourceQuantity"),
                      number(sourceTrace.source_quantity),
                    ],
                    [tUi("goodsTraceAudit.itemCode"), text(sourceTrace.code)],
                    [
                      tUi("goodsTraceAudit.locationBefore"),
                      text(sourceTrace.location_before),
                    ],
                    [
                      tUi("goodsTraceAudit.locationAfter"),
                      text(sourceTrace.location_after),
                    ],
                  ]}
                />
                <p className="goods-trace-note">
                  {tUi("uiAudit.text_fd3d37e8c1")}{" "}
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
                      {tUi("uiAudit.text_8e66a42b0f")}{" "}
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
              <h2 id="goods-trace-export-title">
                {tUi("uiAudit.text_0dc0205800")}
              </h2>
              <button
                className="modal-close"
                aria-label={tUi("uiAudit.text_7996ac5301")}
                onClick={() => setExportOpen(false)}
              >
                ×
              </button>
            </div>
            <p>{tUi("uiAudit.text_8072b40a51")}</p>
            <fieldset>
              <legend>{tUi("uiAudit.text_e6a526455b")}</legend>
              <label>
                <input
                  type="radio"
                  name="exportScope"
                  checked={!exportStock}
                  onChange={() => setExportStock(false)}
                />
                {tUi("uiAudit.text_984d3447fc")}
                {rows.length} {tUi("uiAudit.text_a0dee7f4d3")}{" "}
              </label>
              <label>
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportStock}
                  onChange={() => setExportStock(true)}
                />
                {tUi("uiAudit.text_4c7841feb8")}
                {rows.filter(isStockEvent).length}{" "}
                {tUi("uiAudit.text_a0dee7f4d3")}{" "}
              </label>
            </fieldset>
            <div className="goods-trace-export-grid">
              <Panel title={tUi("uiAudit.text_8de8564851")}>{queryInfo}</Panel>
              <Panel title={tUi("uiAudit.text_b2306f86eb")}>
                {(
                  [
                    ["events", tUi("goodsTraceAudit.eventList")],
                    ["documents", tUi("goodsTraceAudit.documentLinks")],
                    ["relations", tUi("goodsTraceAudit.boxTrayRelations")],
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
            <Panel title={tUi("uiAudit.text_7c313faa2c")}>
              <Facts
                rows={[
                  [
                    tUi("goodsTraceAudit.events"),
                    rows.filter((e) => !exportStock || isStockEvent(e)).length,
                  ],
                  [
                    tUi("goodsTraceAudit.stockImpact"),
                    rows.filter(isStockEvent).length,
                  ],
                  [
                    tUi("goodsTraceAudit.netImpact"),
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
              {tUi("uiAudit.text_6821e27f32")}{" "}
            </p>
            <label>
              {tUi("uiAudit.text_464dd74f34")}{" "}
              <input
                aria-label={tUi("uiAudit.text_464dd74f34")}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </label>
            <p>{tUi("uiAudit.text_b60107ae24")}</p>
            {exportError && <p role="alert">{exportError}</p>}
            <footer>
              <button
                className="goods-trace-cancel"
                onClick={() => setExportOpen(false)}
              >
                {tUi("packingLabelReport.cancel")}{" "}
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
                {exporting
                  ? tUi("goodsTraceAudit.exporting")
                  : tUi("goodsTraceAudit.exportExcel")}
              </button>
            </footer>
          </div>
        </DrillDownModal>
      )}
    </div>
  );
}

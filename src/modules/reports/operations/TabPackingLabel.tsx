import { useMemo, useState } from "react";
import { Box, Stack, UiAlert, UiStatusBadge } from "@/shared/ui";
import {
  PrinterOutlined,
  TagOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ActionButton } from "@/shared/components/actions";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  axisDayLabel,
  dateSpan,
  dayKey,
  fmt,
  fmtDate,
  fmtDateTime,
  listOf,
  n,
  pct,
  text,
  type Raw,
} from "./report-format";
import { useLabelLog, usePrinterOptions } from "./report-data";
import {
  ChartCard,
  ChartGrid,
  DataGapNotice,
  DrillDownDialog,
  FilterBar,
  FormulaNote,
  ReportKpi,
  ReportKpiRow,
  ReportSectionHeading,
} from "./report-ui";
import {
  AllOrPickFilter,
  ExportButtons,
  PeriodFilterControls,
} from "./report-filters";
import { usePeriodFilter } from "./report-period";
import { reportStatusLabel } from "./report-labels";
import { ReportPaginationBar } from "./report-table";
import { useClientPagination } from "./report-columns";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { ReportStatusBadge } from "./report-drilldown";
import { useReportExport } from "./report-export";

const RESULT_OPTIONS = [
  { value: "PRINTED", label: "Đã in" },
  { value: "PRINT_FAILED", label: "In lỗi" },
  { value: "REPRINT", label: "In lại" },
];

type PrintAttempt = {
  at: string;
  status: string;
  printer: string;
  actor: string;
  reason: string;
};

type LabelRow = {
  id: string;
  labelCode: string;
  outboundNo: string;
  outboundDate: string;
  recipient: string;
  status: string;
  attempts: number;
  failed: number;
  reprints: number;
  printer: string;
  printerId: string;
  actor: string;
  lastAttemptAt: string;
  createdAt: string;
  failureReason: string;
  reprintReason: string;
  history: PrintAttempt[];
  raw: Raw;
};

/**
 * Tab 5 — Packing Label: Print / Reprint.
 *
 * `/reports/label-log` trả TỔNG HỢP theo từng nhãn (số lần in, số lần lỗi, số
 * lần in lại) chứ chưa trả danh sách từng lần in. Chỗ nào cần "từng lần" thì
 * đọc `attempts[]` nếu máy chủ có trả, còn không thì quy về mốc thời gian của
 * lần in gần nhất và nói rõ giới hạn đó ngay trên màn hình — im lặng gán tất cả
 * vào một ngày mà không giải thích sẽ khiến chart 5.1 bị đọc sai.
 */
export default function TabPackingLabel() {
  const period = usePeriodFilter("this-month");
  const printers = usePrinterOptions();
  const exporter = useReportExport();

  const [resultFilter, setResultFilter] = useState("");
  const [printerFilter, setPrinterFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [openLabel, setOpenLabel] = useState<LabelRow | null>(null);
  const [printerDrill, setPrinterDrill] = useState<string | null>(null);

  const labelLog = useLabelLog({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });

  const rows = useMemo<LabelRow[]>(() => {
    return listOf(labelLog.data?.rows).map((row) => {
      const history = listOf(row.attempts).map((attempt) => ({
        at: text(attempt.created_at ?? attempt.printed_at, ""),
        status: text(attempt.status, ""),
        printer: text(attempt.printer_name, ""),
        actor: text(attempt.actor_name ?? attempt.created_by_name, ""),
        reason: text(attempt.error_message ?? attempt.reason, ""),
      }));
      return {
        id: text(row.id, ""),
        labelCode: text(row.label_code, ""),
        outboundNo: text(row.outbound_no, ""),
        outboundDate: text(row.outbound_date, ""),
        recipient: text(row.recipient, ""),
        status: text(row.status, ""),
        attempts: n(row.total_attempts),
        failed: n(row.failed_count),
        reprints: n(row.reprint_count),
        printer: text(row.printer_name, ""),
        printerId: text(row.printer_config_id, ""),
        actor: text(row.printed_by_name, ""),
        lastAttemptAt: text(row.last_attempt_at, ""),
        createdAt: text(row.created_at, ""),
        failureReason: text(row.error_message ?? row.failure_reason, ""),
        reprintReason: text(row.reprint_reason, ""),
        history,
        raw: row,
      };
    });
  }, [labelLog.data]);

  const hasAttemptHistory = rows.some((row) => row.history.length > 0);

  const days = useMemo(
    () => dateSpan(period.from, period.to),
    [period.from, period.to],
  );

  // ── 5.1 Kết quả in theo thời gian ──────────────────────────────────────
  const dailySeries = useMemo(() => {
    const blank = () => new Map<string, number>(days.map((day) => [day, 0]));
    const printed = blank();
    const failed = blank();
    const reprint = blank();

    const add = (map: Map<string, number>, day: string, amount: number) => {
      if (!map.has(day) || amount === 0) return;
      map.set(day, (map.get(day) ?? 0) + amount);
    };

    for (const row of rows) {
      if (row.history.length > 0) {
        // Có lịch sử từng lần in: quy đúng mỗi lần vào ngày của chính nó.
        let successSoFar = 0;
        for (const attempt of [...row.history].sort((a, b) =>
          a.at.localeCompare(b.at),
        )) {
          const day = dayKey(attempt.at);
          if (attempt.status === "PRINTED") {
            successSoFar += 1;
            add(printed, day, 1);
            // In lại = lần in THÀNH CÔNG thứ hai trở đi của cùng một nhãn.
            if (successSoFar > 1) add(reprint, day, 1);
          } else {
            add(failed, day, 1);
          }
        }
        continue;
      }
      const day = dayKey(row.lastAttemptAt || row.createdAt);
      add(printed, day, Math.max(0, row.attempts - row.failed));
      add(failed, day, row.failed);
      add(reprint, day, row.reprints);
    }

    return [
      {
        name: "Đã in",
        data: days.map((day) => printed.get(day) ?? 0),
        color: CHART_COLORS.success,
      },
      {
        name: "In lỗi",
        data: days.map((day) => failed.get(day) ?? 0),
        color: CHART_COLORS.danger,
      },
      {
        name: "In lại",
        data: days.map((day) => reprint.get(day) ?? 0),
        color: CHART_COLORS.warning,
      },
    ];
  }, [days, rows]);

  const [dayDrill, setDayDrill] = useState<{
    day: string;
    seriesName: string;
  } | null>(null);

  // ── 5.2 Máy in có nhiều lỗi nhất ───────────────────────────────────────
  const printerFailures = useMemo(() => {
    const counter = new Map<string, { failed: number; attempts: number }>();
    for (const row of rows) {
      const key = row.printer || "Chưa gán máy in";
      const current = counter.get(key) ?? { failed: 0, attempts: 0 };
      current.failed += row.failed;
      current.attempts += row.attempts;
      counter.set(key, current);
    }
    return [...counter.entries()]
      .map(([label, value]) => ({
        label,
        value: value.failed,
        attempts: value.attempts,
      }))
      .filter((item) => item.attempts > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  // ── 5.3 Lịch sử Print / Reprint ────────────────────────────────────────
  const actorOptions = useMemo(() => {
    const values = new Set(
      rows.map((row) => row.actor).filter((value) => value !== ""),
    );
    return [...values]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((value) => ({ value, label: value }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (resultFilter === "PRINTED" && row.status !== "PRINTED") return false;
      if (resultFilter === "PRINT_FAILED" && row.failed === 0) return false;
      if (resultFilter === "REPRINT" && row.reprints === 0) return false;
      if (printerFilter && row.printerId !== printerFilter) return false;
      if (actorFilter && row.actor !== actorFilter) return false;
      if (needle) {
        const haystack =
          `${row.outboundNo} ${row.labelCode} ${row.recipient}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, resultFilter, printerFilter, actorFilter, keyword]);

  const pagination = useClientPagination(filtered, 15);

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          labels: acc.labels + 1,
          attempts: acc.attempts + row.attempts,
          failed: acc.failed + row.failed,
          reprints: acc.reprints + row.reprints,
        }),
        { labels: 0, attempts: 0, failed: 0, reprints: 0 },
      ),
    [rows],
  );

  return (
    <Box data-testid="rpt-tab-packing-label">
      <ReportSectionHeading
        id="rpt-tab5-heading"
        title="Báo cáo Packing Label – Print / Reprint"
        description="Kết quả in nhãn theo ngày, máy in hay lỗi nhất và nhật ký từng nhãn."
      />

      <FilterBar
        label="Bộ lọc kỳ báo cáo"
        hint={`Kỳ đang xem: ${period.label} · ${fmt(rows.length)} nhãn`}
      >
        <PeriodFilterControls state={period} />
      </FilterBar>

      {period.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
          </UiAlert>
        </Box>
      ) : null}

      {!hasAttemptHistory && rows.length > 0 ? (
        <DataGapNotice>
          Máy chủ hiện trả tổng hợp theo từng nhãn (số lần in / lỗi / in lại),
          chưa trả danh sách <b>từng lần in</b> kèm lý do. Vì vậy biểu đồ kết
          quả in theo thời gian quy các lần in của một nhãn về{" "}
          <b>ngày in gần nhất</b>, và hai cột "Lý do lỗi" / "Lý do Reprint" ở
          bảng nhật ký để trống. Khi API bổ sung
          <code> attempts[]</code>, màn hình này tự hiển thị đầy đủ mà không cần
          sửa gì thêm.
        </DataGapNotice>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label="Nhãn đóng gói"
          value={fmt(summary.labels)}
          tone="primary"
          icon={<TagOutlined />}
        />
        <ReportKpi
          label="Tổng lần in"
          value={fmt(summary.attempts)}
          tone="info"
          icon={<PrinterOutlined />}
        />
        <ReportKpi
          label="Lần in lỗi"
          value={fmt(summary.failed)}
          tone="error"
          icon={<WarningOutlined />}
          hint={pct(summary.failed, summary.attempts)}
          onClick={() => setResultFilter("PRINT_FAILED")}
        />
        <ReportKpi
          label="Lần in lại"
          value={fmt(summary.reprints)}
          tone="warning"
          icon={<UndoOutlined />}
          hint={pct(summary.reprints, summary.attempts)}
          onClick={() => setResultFilter("REPRINT")}
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title="Kết quả in theo thời gian"
          description="Số lần đã in / in lỗi / in lại theo từng ngày trong kỳ."
          loading={labelLog.isLoading}
          error={labelLog.error}
          onRetry={() => void labelLog.refetch()}
          empty={days.length === 0 || summary.attempts === 0}
          emptyText="Kỳ này chưa có lần in nhãn nào."
        >
          <MultiSeriesBarChart
            stacked
            categories={days.map(axisDayLabel)}
            series={dailySeries}
            height={320}
            valueFormatter={fmt}
            onSelect={(payload) =>
              setDayDrill({
                day: days[payload.categoryIndex] ?? "",
                seriesName: payload.seriesName,
              })
            }
          />
        </ChartCard>

        <ChartCard
          title="Máy in có nhiều lỗi nhất"
          description="Số lần in lỗi theo từng máy in — bấm để xem các nhãn liên quan."
          loading={labelLog.isLoading}
          error={labelLog.error}
          onRetry={() => void labelLog.refetch()}
          empty={printerFailures.every((item) => item.value === 0)}
          emptyText="Không có máy in nào phát sinh lỗi trong kỳ."
          footer={
            <FormulaNote>
              Tỉ lệ lỗi từng máy = số lần in lỗi ÷ tổng số lần in của máy đó
              (xem tooltip trên bảng nhật ký bên dưới).
            </FormulaNote>
          }
        >
          <HorizontalBarChart
            items={printerFailures}
            limit={10}
            color={CHART_COLORS.danger}
            valueFormatter={fmt}
            onSelect={(item) => setPrinterDrill(item.label)}
          />
        </ChartCard>
      </ChartGrid>

      <ReportSectionHeading
        id="rpt-tab5-history"
        title="Lịch sử Print / Reprint"
        description="Bấm vào một phiếu để xem toàn bộ lịch sử các lần in / in lại của nhãn đó."
      />

      <FilterBar
        label="Bộ lọc bảng nhật ký in"
        hint={`${fmt(filtered.length)} nhãn`}
        actions={
          <ExportButtons
            exporting={exporter.exporting}
            disabled={period.invalid || labelLog.isLoading}
            onExport={(format) =>
              void exporter.exportReport(format, {
                reportCode: "label-log",
                fileStem: "packing-label-log",
                fileSuffix: `-${period.from}-${period.to}`,
                filters: {
                  from_date: period.from,
                  to_date: period.to,
                  ...(resultFilter === "PRINTED"
                    ? { status: "PRINTED" }
                    : resultFilter === "PRINT_FAILED"
                      ? { status: "PRINT_FAILED" }
                      : {}),
                  ...(printerFilter ? { printer_id: printerFilter } : {}),
                  ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
                },
              })
            }
          />
        }
      >
        <AllOrPickFilter
          value={resultFilter}
          onChange={setResultFilter}
          options={RESULT_OPTIONS}
          allLabel="Tất cả kết quả in"
          ariaLabel="Kết quả in"
        />
        <AllOrPickFilter
          value={printerFilter}
          onChange={setPrinterFilter}
          options={printers.options}
          allLabel="Tất cả máy in"
          ariaLabel="Máy in"
          minWidth={210}
        />
        <AllOrPickFilter
          value={actorFilter}
          onChange={setActorFilter}
          options={actorOptions}
          allLabel="Tất cả người in"
          ariaLabel="Người thực hiện"
          minWidth={200}
        />
        <SearchInput
          width={260}
          placeholder="Phiếu xuất / Label ID / nơi nhận"
          aria-label="Tìm phiếu xuất, label ID hoặc nơi nhận"
          value={keyword}
          onChange={setKeyword}
        />
      </FilterBar>

      {labelLog.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={labelLog.error}
            title="Không tải được nhật ký nhãn đóng gói"
            onRetry={() => void labelLog.refetch()}
          />
        </Box>
      ) : null}

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title="Xuất báo cáo bị từ chối quyền."
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      <ResponsiveDataTable<LabelRow>
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
            key: "outboundNo",
            header: "Phiếu xuất",
            width: 170,
            sortAccessor: (row) => row.outboundNo,
            render: (row) => (
              <Box>
                <Box sx={{ fontWeight: 700 }}>{row.outboundNo || EMPTY_TEXT}</Box>
                <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                  {row.outboundDate ? fmtDate(row.outboundDate) : ""}
                </Box>
              </Box>
            ),
          },
          {
            key: "labelCode",
            header: "Label ID",
            width: 170,
            sortAccessor: (row) => row.labelCode,
            render: (row) => row.labelCode || EMPTY_TEXT,
          },
          {
            key: "status",
            header: "Trạng thái in",
            width: 150,
            render: (row) => (
              <ReportStatusBadge
                value={row.status}
                label={reportStatusLabel(row.status)}
              />
            ),
          },
          {
            key: "attempts",
            header: "Số lần in",
            align: "right",
            width: 110,
            sortAccessor: (row) => row.attempts,
            render: (row) => fmt(row.attempts),
          },
          {
            key: "reprints",
            header: "Số lần Reprint",
            align: "right",
            width: 140,
            sortAccessor: (row) => row.reprints,
            render: (row) => fmt(row.reprints),
          },
          {
            key: "printer",
            header: "Máy in",
            hideOnMobile: true,
            render: (row) => row.printer || EMPTY_TEXT,
          },
          {
            key: "actor",
            header: "Người in",
            hideOnMobile: true,
            render: (row) => row.actor || EMPTY_TEXT,
          },
          {
            key: "lastAttemptAt",
            header: "Thời gian",
            width: 165,
            sortAccessor: (row) => row.lastAttemptAt,
            render: (row) =>
              row.lastAttemptAt ? fmtDateTime(row.lastAttemptAt) : EMPTY_TEXT,
          },
          {
            key: "failureReason",
            header: "Lý do lỗi",
            hideOnMobile: true,
            render: (row) =>
              row.failureReason ||
              (row.failed > 0 ? `${fmt(row.failed)} lần lỗi` : EMPTY_TEXT),
          },
          {
            key: "reprintReason",
            header: "Lý do Reprint",
            hideOnMobile: true,
            render: (row) => row.reprintReason || EMPTY_TEXT,
          },
        ]}
        rows={pagination.pageRows}
        rowKey={(row) => row.id}
        loading={labelLog.isLoading}
        onRowClick={(row) => setOpenLabel(row)}
        emptyText="Không có nhãn nào theo bộ lọc."
        renderRowActions={(row) => (
          <ActionButton
            kind="history"
            aria-label="Xem lịch sử in của nhãn"
            sx={{ whiteSpace: "nowrap" }}
            onClick={() => setOpenLabel(row)}
          />
        )}
      />
      <ReportPaginationBar
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPerPage}
      />

      {dayDrill ? (
        <DrillDownDialog
          title={`${dayDrill.seriesName} — ngày ${fmtDate(dayDrill.day)}`}
          onClose={() => setDayDrill(null)}
        >
          <ResponsiveDataTable<LabelRow>
            columns={[
              {
                key: "outboundNo",
                header: "Phiếu xuất",
                render: (row) => row.outboundNo || EMPTY_TEXT,
              },
              {
                key: "labelCode",
                header: "Label ID",
                render: (row) => row.labelCode || EMPTY_TEXT,
              },
              {
                key: "printer",
                header: "Máy in",
                render: (row) => row.printer || EMPTY_TEXT,
              },
              {
                key: "attempts",
                header: "Lần in",
                align: "right",
                render: (row) => fmt(row.attempts),
              },
              {
                key: "failed",
                header: "Lỗi",
                align: "right",
                render: (row) => fmt(row.failed),
              },
              {
                key: "reprints",
                header: "In lại",
                align: "right",
                render: (row) => fmt(row.reprints),
              },
            ]}
            rows={rows.filter(
              (row) =>
                dayKey(row.lastAttemptAt || row.createdAt) === dayDrill.day,
            )}
            rowKey={(row) => row.id}
            emptyText="Không có nhãn nào trong ngày này."
          />
        </DrillDownDialog>
      ) : null}

      {printerDrill ? (
        <DrillDownDialog
          title={`Nhãn in trên máy ${printerDrill}`}
          onClose={() => setPrinterDrill(null)}
        >
          <ResponsiveDataTable<LabelRow>
            columns={[
              {
                key: "outboundNo",
                header: "Phiếu xuất",
                render: (row) => row.outboundNo || EMPTY_TEXT,
              },
              {
                key: "labelCode",
                header: "Label ID",
                render: (row) => row.labelCode || EMPTY_TEXT,
              },
              {
                key: "status",
                header: "Trạng thái",
                render: (row) => reportStatusLabel(row.status),
              },
              {
                key: "failed",
                header: "Số lần lỗi",
                align: "right",
                render: (row) => fmt(row.failed),
              },
              {
                key: "actor",
                header: "Người in",
                render: (row) => row.actor || EMPTY_TEXT,
              },
            ]}
            rows={rows.filter(
              (row) => (row.printer || "Chưa gán máy in") === printerDrill,
            )}
            rowKey={(row) => row.id}
            emptyText="Không có nhãn nào."
          />
        </DrillDownDialog>
      ) : null}

      {openLabel ? (
        <DrillDownDialog
          title={`Lịch sử in nhãn ${openLabel.labelCode || openLabel.outboundNo}`}
          subtitle={`Phiếu xuất ${openLabel.outboundNo} · ${openLabel.recipient}`}
          onClose={() => setOpenLabel(null)}
          maxWidth="md"
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1.5 }}>
            <UiStatusBadge
              size="small"
              tone="info"
              label={`Tổng ${fmt(openLabel.attempts)} lần in`}
            />
            <UiStatusBadge
              size="small"
              tone="error"
              label={`${fmt(openLabel.failed)} lần lỗi`}
            />
            <UiStatusBadge
              size="small"
              tone="warning"
              label={`${fmt(openLabel.reprints)} lần in lại`}
            />
            <UiStatusBadge
              size="small"
              tone="neutral"
              label={`Máy in: ${openLabel.printer || EMPTY_TEXT}`}
            />
          </Stack>
          {openLabel.history.length > 0 ? (
            <ResponsiveDataTable<PrintAttempt>
              columns={[
                {
                  key: "at",
                  header: "Thời gian",
                  render: (row) => (row.at ? fmtDateTime(row.at) : EMPTY_TEXT),
                },
                {
                  key: "status",
                  header: "Kết quả",
                  render: (row) => reportStatusLabel(row.status),
                },
                {
                  key: "printer",
                  header: "Máy in",
                  render: (row) => row.printer || EMPTY_TEXT,
                },
                {
                  key: "actor",
                  header: "Người in",
                  render: (row) => row.actor || EMPTY_TEXT,
                },
                {
                  key: "reason",
                  header: "Lý do",
                  render: (row) => row.reason || EMPTY_TEXT,
                },
              ]}
              rows={openLabel.history}
              rowKey={(row) => `${row.at}-${row.status}`}
              emptyText="Chưa có lần in nào."
            />
          ) : (
            <UiAlert tone="info">
              Máy chủ chưa trả danh sách từng lần in cho nhãn này. Số liệu đang
              có: {fmt(openLabel.attempts)} lần in, {fmt(openLabel.failed)} lần
              lỗi, {fmt(openLabel.reprints)} lần in lại; lần in gần nhất lúc{" "}
              {openLabel.lastAttemptAt
                ? fmtDateTime(openLabel.lastAttemptAt)
                : EMPTY_TEXT}{" "}
              trên máy {openLabel.printer || EMPTY_TEXT}.
            </UiAlert>
          )}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}

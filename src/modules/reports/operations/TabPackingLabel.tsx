import { useT, type TranslateFn } from "@/shared/i18n/useT";
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

const resultOptions = (t: TranslateFn) => [
  { value: "PRINTED", label: t("reports.packingLabel.outcomePrinted") },
  { value: "PRINT_FAILED", label: t("reports.packingLabel.outcomeFailed") },
  { value: "REPRINT", label: t("reports.packingLabel.outcomeReprint") },
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
  const t = useT();
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
        name: t("reports.packingLabel.outcomePrinted"),
        data: days.map((day) => printed.get(day) ?? 0),
        color: CHART_COLORS.success,
      },
      {
        name: t("reports.packingLabel.outcomeFailed"),
        data: days.map((day) => failed.get(day) ?? 0),
        color: CHART_COLORS.danger,
      },
      {
        name: t("reports.packingLabel.outcomeReprint"),
        data: days.map((day) => reprint.get(day) ?? 0),
        color: CHART_COLORS.warning,
      },
    ];
  }, [days, rows, t]);

  const [dayDrill, setDayDrill] = useState<{
    day: string;
    seriesName: string;
  } | null>(null);

  // ── 5.2 Máy in có nhiều lỗi nhất ───────────────────────────────────────
  const printerFailures = useMemo(() => {
    const counter = new Map<string, { failed: number; attempts: number }>();
    for (const row of rows) {
      const key = row.printer || t("reports.packingLabel.noPrinter");
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
  }, [rows, t]);

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
        title={t("reports.packingLabel.title")}
        description={t("reports.packingLabel.description")}
      />

      <FilterBar
        label={t("reports.packingLabel.filterLabel")}
        hint={t("reports.packingLabel.filterHint", {
          label: period.label,
          count: fmt(rows.length),
        })}
      >
        <PeriodFilterControls state={period} />
      </FilterBar>

      {period.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">{t("reports.common.dateOrderError")}</UiAlert>
        </Box>
      ) : null}

      {!hasAttemptHistory && rows.length > 0 ? (
        <DataGapNotice>
          {t("reports.packingLabel.apiNoteA")}{" "}
          <b>{t("reports.packingLabel.apiNoteB")}</b>{" "}
          {t("reports.packingLabel.apiNoteC")}{" "}
          <b>{t("reports.packingLabel.apiNoteD")}</b>
          {t("reports.packingLabel.apiNoteE")}
          <code> attempts[]</code>
          {t("reports.packingLabel.apiNoteF")}
        </DataGapNotice>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label={t("reports.packingLabel.kpiLabels")}
          value={fmt(summary.labels)}
          tone="primary"
          icon={<TagOutlined />}
        />
        <ReportKpi
          label={t("reports.packingLabel.kpiAttempts")}
          value={fmt(summary.attempts)}
          tone="info"
          icon={<PrinterOutlined />}
        />
        <ReportKpi
          label={t("reports.packingLabel.kpiFailed")}
          value={fmt(summary.failed)}
          tone="error"
          icon={<WarningOutlined />}
          hint={pct(summary.failed, summary.attempts)}
          onClick={() => setResultFilter("PRINT_FAILED")}
        />
        <ReportKpi
          label={t("reports.packingLabel.kpiReprints")}
          value={fmt(summary.reprints)}
          tone="warning"
          icon={<UndoOutlined />}
          hint={pct(summary.reprints, summary.attempts)}
          onClick={() => setResultFilter("REPRINT")}
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title={t("reports.packingLabel.dailyTitle")}
          description={t("reports.packingLabel.dailyDescription")}
          loading={labelLog.isLoading}
          error={labelLog.error}
          onRetry={() => void labelLog.refetch()}
          empty={days.length === 0 || summary.attempts === 0}
          emptyText={t("reports.packingLabel.dailyEmpty")}
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
          title={t("reports.packingLabel.printerTitle")}
          description={t("reports.packingLabel.printerDescription")}
          loading={labelLog.isLoading}
          error={labelLog.error}
          onRetry={() => void labelLog.refetch()}
          empty={printerFailures.every((item) => item.value === 0)}
          emptyText={t("reports.packingLabel.printerEmpty")}
          footer={
            <FormulaNote>{t("reports.packingLabel.printerNote")}</FormulaNote>
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
        title={t("reports.packingLabel.logTitle")}
        description={t("reports.packingLabel.logDescription")}
      />

      <FilterBar
        label={t("reports.packingLabel.logFilterLabel")}
        hint={t("reports.packingLabel.logFilterHint", {
          count: fmt(filtered.length),
        })}
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
          options={resultOptions(t)}
          allLabel={t("reports.packingLabel.outcomeAll")}
          ariaLabel={t("reports.packingLabel.outcomeAria")}
        />
        <AllOrPickFilter
          value={printerFilter}
          onChange={setPrinterFilter}
          options={printers.options}
          allLabel={t("reports.packingLabel.printerAll")}
          ariaLabel={t("reports.packingLabel.printerAria")}
          minWidth={210}
        />
        <AllOrPickFilter
          value={actorFilter}
          onChange={setActorFilter}
          options={actorOptions}
          allLabel={t("reports.packingLabel.actorAll")}
          ariaLabel={t("reports.packingLabel.actorAria")}
          minWidth={200}
        />
        <SearchInput
          width={260}
          placeholder={t("reports.packingLabel.searchPlaceholder")}
          aria-label={t("reports.packingLabel.searchAria")}
          value={keyword}
          onChange={setKeyword}
        />
      </FilterBar>

      {labelLog.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={labelLog.error}
            title={t("reports.packingLabel.logLoadError")}
            onRetry={() => void labelLog.refetch()}
          />
        </Box>
      ) : null}

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title={t("reports.common.exportDenied")}
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
            header: t("reports.packingLabel.colOutbound"),
            width: 170,
            sortAccessor: (row) => row.outboundNo,
            render: (row) => (
              <Box>
                <Box sx={{ fontWeight: 700 }}>
                  {row.outboundNo || EMPTY_TEXT}
                </Box>
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
            header: t("reports.packingLabel.colPrintStatus"),
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
            header: t("reports.packingLabel.colAttempts"),
            align: "right",
            width: 110,
            sortAccessor: (row) => row.attempts,
            render: (row) => fmt(row.attempts),
          },
          {
            key: "reprints",
            header: t("reports.packingLabel.colReprints"),
            align: "right",
            width: 140,
            sortAccessor: (row) => row.reprints,
            render: (row) => fmt(row.reprints),
          },
          {
            key: "printer",
            header: t("reports.packingLabel.colPrinter"),
            hideOnMobile: true,
            render: (row) => row.printer || EMPTY_TEXT,
          },
          {
            key: "actor",
            header: t("reports.packingLabel.colOperator"),
            hideOnMobile: true,
            render: (row) => row.actor || EMPTY_TEXT,
          },
          {
            key: "lastAttemptAt",
            header: t("reports.packingLabel.colTime"),
            width: 165,
            sortAccessor: (row) => row.lastAttemptAt,
            render: (row) =>
              row.lastAttemptAt ? fmtDateTime(row.lastAttemptAt) : EMPTY_TEXT,
          },
          {
            key: "failureReason",
            header: t("reports.packingLabel.colFailReason"),
            hideOnMobile: true,
            render: (row) =>
              row.failureReason || row.failed > 0
                ? t("reports.packingLabel.failCount", {
                    count: fmt(row.failed),
                  })
                : EMPTY_TEXT,
          },
          {
            key: "reprintReason",
            header: t("reports.packingLabel.colReprintReason"),
            hideOnMobile: true,
            render: (row) => row.reprintReason || EMPTY_TEXT,
          },
        ]}
        rows={pagination.pageRows}
        rowKey={(row) => row.id}
        loading={labelLog.isLoading}
        onRowClick={(row) => setOpenLabel(row)}
        emptyText={t("reports.packingLabel.logEmpty")}
        renderRowActions={(row) => (
          <ActionButton
            kind="history"
            aria-label={t("reports.packingLabel.logRowAria")}
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
          title={t("reports.packingLabel.dayDrillTitle", {
            series: dayDrill.seriesName,
            date: fmtDate(dayDrill.day),
          })}
          onClose={() => setDayDrill(null)}
        >
          <ResponsiveDataTable<LabelRow>
            columns={[
              {
                key: "outboundNo",
                header: t("reports.packingLabel.colOutbound"),
                render: (row) => row.outboundNo || EMPTY_TEXT,
              },
              {
                key: "labelCode",
                header: "Label ID",
                render: (row) => row.labelCode || EMPTY_TEXT,
              },
              {
                key: "printer",
                header: t("reports.packingLabel.colPrinter"),
                render: (row) => row.printer || EMPTY_TEXT,
              },
              {
                key: "attempts",
                header: t("reports.packingLabel.colPrintCount"),
                align: "right",
                render: (row) => fmt(row.attempts),
              },
              {
                key: "failed",
                header: t("reports.packingLabel.colFailed"),
                align: "right",
                render: (row) => fmt(row.failed),
              },
              {
                key: "reprints",
                header: t("reports.packingLabel.colReprint"),
                align: "right",
                render: (row) => fmt(row.reprints),
              },
            ]}
            rows={rows.filter(
              (row) =>
                dayKey(row.lastAttemptAt || row.createdAt) === dayDrill.day,
            )}
            rowKey={(row) => row.id}
            emptyText={t("reports.packingLabel.dayDrillEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {printerDrill ? (
        <DrillDownDialog
          title={t("reports.packingLabel.printerDrillTitle", {
            printer: printerDrill,
          })}
          onClose={() => setPrinterDrill(null)}
        >
          <ResponsiveDataTable<LabelRow>
            columns={[
              {
                key: "outboundNo",
                header: t("reports.packingLabel.colOutbound"),
                render: (row) => row.outboundNo || EMPTY_TEXT,
              },
              {
                key: "labelCode",
                header: "Label ID",
                render: (row) => row.labelCode || EMPTY_TEXT,
              },
              {
                key: "status",
                header: t("reports.packingLabel.colStatus"),
                render: (row) => reportStatusLabel(row.status),
              },
              {
                key: "failed",
                header: t("reports.packingLabel.colFailCount"),
                align: "right",
                render: (row) => fmt(row.failed),
              },
              {
                key: "actor",
                header: t("reports.packingLabel.colOperator"),
                render: (row) => row.actor || EMPTY_TEXT,
              },
            ]}
            rows={rows.filter(
              (row) =>
                (row.printer || t("reports.packingLabel.noPrinter")) ===
                printerDrill,
            )}
            rowKey={(row) => row.id}
            emptyText={t("reports.packingLabel.printerDrillEmpty")}
          />
        </DrillDownDialog>
      ) : null}

      {openLabel ? (
        <DrillDownDialog
          title={t("reports.packingLabel.historyTitle", {
            code: openLabel.labelCode || openLabel.outboundNo,
          })}
          subtitle={t("reports.packingLabel.historySubtitle", {
            outbound: openLabel.outboundNo,
            recipient: openLabel.recipient,
          })}
          onClose={() => setOpenLabel(null)}
          maxWidth="md"
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1.5 }}>
            <UiStatusBadge
              size="small"
              tone="info"
              label={t("reports.packingLabel.badgeAttempts", {
                count: fmt(openLabel.attempts),
              })}
            />
            <UiStatusBadge
              size="small"
              tone="error"
              label={t("reports.packingLabel.badgeFailed", {
                count: fmt(openLabel.failed),
              })}
            />
            <UiStatusBadge
              size="small"
              tone="warning"
              label={t("reports.packingLabel.badgeReprints", {
                count: fmt(openLabel.reprints),
              })}
            />
            <UiStatusBadge
              size="small"
              tone="neutral"
              label={t("reports.packingLabel.badgePrinter", {
                printer: openLabel.printer || EMPTY_TEXT,
              })}
            />
          </Stack>
          {openLabel.history.length > 0 ? (
            <ResponsiveDataTable<PrintAttempt>
              columns={[
                {
                  key: "at",
                  header: t("reports.packingLabel.colTime"),
                  render: (row) => (row.at ? fmtDateTime(row.at) : EMPTY_TEXT),
                },
                {
                  key: "status",
                  header: t("reports.packingLabel.colResult"),
                  render: (row) => reportStatusLabel(row.status),
                },
                {
                  key: "printer",
                  header: t("reports.packingLabel.colPrinter"),
                  render: (row) => row.printer || EMPTY_TEXT,
                },
                {
                  key: "actor",
                  header: t("reports.packingLabel.colOperator"),
                  render: (row) => row.actor || EMPTY_TEXT,
                },
                {
                  key: "reason",
                  header: t("reports.packingLabel.colReason"),
                  render: (row) => row.reason || EMPTY_TEXT,
                },
              ]}
              rows={openLabel.history}
              rowKey={(row) => `${row.at}-${row.status}`}
              emptyText={t("reports.packingLabel.historyEmpty")}
            />
          ) : (
            <UiAlert tone="info">
              {t("reports.packingLabel.historyNoteA")}{" "}
              {t("reports.packingLabel.historyNoteB", {
                attempts: fmt(openLabel.attempts),
                failed: fmt(openLabel.failed),
                reprints: fmt(openLabel.reprints),
              })}{" "}
              {openLabel.lastAttemptAt
                ? fmtDateTime(openLabel.lastAttemptAt)
                : EMPTY_TEXT}{" "}
              {t("reports.packingLabel.historyNoteC", {
                printer: openLabel.printer || EMPTY_TEXT,
              })}
            </UiAlert>
          )}
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}

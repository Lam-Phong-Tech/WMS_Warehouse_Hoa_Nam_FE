import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import {
  Box,
  Stack,
  UiCard,
  UiDateRangePicker,
  UiSelect,
  UiStatusBadge,
  UiTextField,
} from "@/shared/ui";
import { http } from "@/shared/api/http";
import { TopPagination } from "@/shared/components";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  RECIPIENT_TYPE_LABELS,
  recipientTypeLabel,
  type RecipientType,
} from "@/shared/constants/recipient-types";
import { formatDate } from "@/shared/utils/format-date";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import {
  ReportChartGrid,
  ReportChartPanel,
} from "@/shared/components/reports/ReportChartPanel";

type Raw = Record<string, unknown>;

type SelectOption = { value: string; label: string };

function text(value: unknown, fallback = "—"): string {
  return value === undefined || value === null || value === ""
    ? fallback
    : String(value);
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsOf(value: unknown): Raw[] {
  if (Array.isArray(value)) return value as Raw[];
  if (value && typeof value === "object") {
    const rows = (value as Raw).rows;
    if (Array.isArray(rows)) return rows as Raw[];
  }
  return [];
}

function RecipientReport() {
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  const [recipientType, setRecipientType] = useState<
    RecipientType | undefined
  >();
  const [recipientId, setRecipientId] = useState<string>();
  const [market, setMarket] = useState<string>();
  const [region, setRegion] = useState<string>();
  const [skuCode, setSkuCode] = useState<string>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const recipientQuery = useQuery({
    queryKey: ["gd1", "recipients", recipientType],
    queryFn: () =>
      http.getPage<Raw[]>("/recipients", {
        params: {
          status: "ACTIVE",
          recipient_type: recipientType,
          per_page: 200,
        },
      }),
  });
  const recipients = Array.isArray(recipientQuery.data?.data)
    ? recipientQuery.data.data
    : [];

  const marketOptions = useMemo<SelectOption[]>(() => {
    const values = new Set(
      recipients.map((row) => text(row.market, "")).filter(Boolean),
    );
    return [...values].sort().map((value) => ({ value, label: value }));
  }, [recipients]);
  const regionOptions = useMemo<SelectOption[]>(() => {
    const values = new Set(
      recipients.map((row) => text(row.region, "")).filter(Boolean),
    );
    return [...values].sort().map((value) => ({ value, label: value }));
  }, [recipients]);
  const recipientOptions: SelectOption[] = recipients.map((row) => ({
    value: text(row.agency_id, ""),
    label: `${text(row.agency_code, "")} · ${text(row.agency_name)}`,
  }));

  const params = {
    from_date: period[0].format("YYYY-MM-DD"),
    to_date: period[1].format("YYYY-MM-DD"),
    recipient_type: recipientType,
    recipient_id: recipientId,
    market,
    region,
    sku_code: skuCode?.trim() || undefined,
    page,
    per_page: perPage,
  };
  const reportQuery = useQuery({
    queryKey: ["gd1", "outbound-by-recipient", params],
    queryFn: () => http.get<Raw>("/reports/outbound-by-recipient", { params }),
  });
  const data = (reportQuery.data ?? {}) as Raw;
  const rows = rowsOf(data.rows ?? data);
  const summary = (data.summary ?? {}) as Raw;
  const pagination = (data.pagination ?? {}) as Raw;
  const bySku = rowsOf(data.by_sku);
  const byRecipient = rowsOf(data.by_recipient);
  const fmt = (value: number) => value.toLocaleString("vi-VN");

  const rowKey = (row: Raw) =>
    `${text(row.document_id, "")}-${text(row.sku_id, "")}-${text(row.recipient_id, "")}`;
  const rowSelection = useRowSelection(rows, rowKey);
  const currentPage = number(pagination.current_page) || page;

  const columns: ResponsiveTableColumn<Raw>[] = [
    {
      // DataTable cũ tự thêm cột STT theo pagination current/pageSize —
      // ResponsiveDataTable không có nên khai tường minh, cùng công thức.
      key: "stt",
      header: "STT",
      align: "center",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(
          currentPage,
          perPage,
          rows.findIndex((candidate) => rowKey(candidate) === rowKey(row)),
        ),
    },
    {
      key: "document_date",
      header: "Ngày",
      width: 115,
      sortType: "value",
      sortAccessor: (row) => new Date(text(row.document_date, "")).getTime(),
      render: (row) => formatDate(text(row.document_date, "")),
    },
    {
      key: "outbound_no",
      header: "Phiếu",
      width: 150,
      sortAccessor: (row) => text(row.outbound_no),
      render: (row) => text(row.outbound_no),
    },
    {
      key: "recipient_type",
      header: "Loại nơi nhận",
      width: 150,
      sortAccessor: (row) => recipientTypeLabel(text(row.recipient_type, "")),
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={recipientTypeLabel(text(row.recipient_type, ""))}
        />
      ),
    },
    {
      key: "recipient_name",
      header: "Nơi nhận",
      width: 210,
      sortAccessor: (row) => text(row.recipient_name),
      render: (row) => text(row.recipient_name),
    },
    {
      key: "market",
      header: "Thị trường",
      width: 130,
      sortAccessor: (row) => text(row.market),
      render: (row) => text(row.market),
    },
    {
      key: "region",
      header: "Khu vực",
      width: 130,
      sortAccessor: (row) => text(row.region),
      render: (row) => text(row.region),
    },
    {
      key: "product_code",
      header: "SKU",
      width: 150,
      sortAccessor: (row) => text(row.product_code),
      render: (row) => text(row.product_code),
    },
    {
      key: "product_name",
      header: "Tên SKU",
      width: 210,
      sortAccessor: (row) => text(row.product_name),
      render: (row) => text(row.product_name),
    },
    {
      key: "issued_qty",
      header: "SL xuất",
      width: 100,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => number(row.issued_qty),
      render: (row) => number(row.issued_qty).toLocaleString("vi-VN"),
    },
  ];

  return (
    <Stack spacing={1.75} sx={{ width: "100%" }}>
      <UiCard>
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
        >
          <UiDateRangePicker
            value={period}
            format="DD/MM/YYYY"
            aria-label="Khoảng thời gian"
            onChange={(value) => {
              if (value?.[0] && value?.[1]) {
                setPeriod([value[0], value[1]]);
                setPage(1);
              }
            }}
          />
          <UiSelect
            minWidth={180}
            placeholder="Loại nơi nhận"
            aria-label="Loại nơi nhận"
            value={recipientType ?? ""}
            options={Object.entries(RECIPIENT_TYPE_LABELS).map(
              ([value, label]) => ({
                value,
                label,
              }),
            )}
            onChange={(value) => {
              setRecipientType(
                (value || undefined) as RecipientType | undefined,
              );
              setRecipientId(undefined);
              setMarket(undefined);
              setRegion(undefined);
              setPage(1);
            }}
          />
          <UiSelect
            minWidth={240}
            placeholder="Nơi nhận"
            aria-label="Nơi nhận"
            value={recipientId ?? ""}
            options={recipientOptions}
            onChange={(value) => {
              setRecipientId(value || undefined);
              setPage(1);
            }}
          />
          <UiSelect
            minWidth={160}
            placeholder="Thị trường"
            aria-label="Thị trường"
            value={market ?? ""}
            options={marketOptions}
            onChange={(value) => {
              setMarket(value || undefined);
              setPage(1);
            }}
          />
          <UiSelect
            minWidth={160}
            placeholder="Khu vực"
            aria-label="Khu vực"
            value={region ?? ""}
            options={regionOptions}
            onChange={(value) => {
              setRegion(value || undefined);
              setPage(1);
            }}
          />
          <UiTextField
            sx={{ width: 180 }}
            value={skuCode ?? ""}
            placeholder="Mã SKU"
            slotProps={{ htmlInput: { "aria-label": "Mã SKU" } }}
            onChange={(event) => {
              setSkuCode(event.target.value);
              setPage(1);
            }}
          />
        </Stack>
      </UiCard>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
        <UiStatusBadge
          tone="info"
          label={`Nơi nhận: ${number(summary.total_recipients ?? summary.total_agencies)}`}
        />
        <UiStatusBadge
          tone="neutral"
          label={`Phiếu: ${number(summary.total_documents)}`}
        />
        <UiStatusBadge
          tone="success"
          label={`Tổng xuất: ${number(summary.total_issued_qty).toLocaleString("vi-VN")}`}
        />
      </Stack>

      {reportQuery.isError ? (
        <ApiErrorAlert
          error={reportQuery.error}
          title="Không tải được báo cáo xuất theo nơi nhận"
          onRetry={() => reportQuery.refetch()}
        />
      ) : null}

      {bySku.length > 0 || byRecipient.length > 0 ? (
        <ReportChartGrid>
          <ReportChartPanel
            title="SL xuất theo SKU"
            description="Tổng SL xuất trong tập lọc hiện tại, theo từng SKU."
          >
            <HorizontalBarChart
              items={bySku.map((row) => ({
                label: text(row.product_name),
                value: number(row.issued_qty),
              }))}
              valueFormatter={fmt}
            />
          </ReportChartPanel>
          <ReportChartPanel
            title="Top nơi nhận"
            description="Nơi nhận có SL xuất cao nhất trong tập lọc hiện tại."
          >
            <HorizontalBarChart
              items={byRecipient.map((row) => ({
                label: text(row.agency_name),
                value: number(row.issued_qty),
              }))}
              valueFormatter={fmt}
            />
          </ReportChartPanel>
        </ReportChartGrid>
      ) : null}

      {/* Gộp chọn số dòng/trang + điều hướng trang vào một khu vực duy nhất,
          ngay sát bảng — trước đây Select "số dòng/trang" nằm tít trên thanh
          filter còn phân trang lại nằm tít dưới bảng, tách rời nhau khó tìm. */}
      <Box>
        <TopPagination
          total={number(pagination.total) || rows.length}
          current={currentPage}
          pageSize={perPage}
          unitName="dòng"
          pageSizeOptions={[10, 20, 50]}
          onChange={(newPage, newPageSize) => {
            if (newPageSize !== perPage) {
              setPerPage(newPageSize);
              setPage(1);
            } else {
              setPage(newPage);
            }
          }}
        />
        {/* Chỉ khoá bảng khi tải lần đầu — ResponsiveDataTable thay hẳn nội dung
            bằng "Đang tải..." khi loading, nên isFetching báo qua banner để bảng
            không trắng xoá mỗi lần đổi trang/lọc (khác overlay của antd cũ). */}
        <TableLoadingBanner
          loading={reportQuery.isLoading || reportQuery.isFetching}
        />
        <ResponsiveDataTable<Raw>
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          rowSelection={rowSelection}
          loading={reportQuery.isLoading}
          emptyText={tableEmptyText(
            reportQuery.isError ? reportQuery.error : null,
            "Chưa có dữ liệu xuất theo bộ lọc hiện tại",
          )}
        />
      </Box>
    </Stack>
  );
}

export default function Gd1ScopeReports() {
  return <RecipientReport />;
}

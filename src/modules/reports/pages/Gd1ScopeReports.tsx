import { useMemo, useState, type Key } from "react";
import { Card, DatePicker, Empty, Input, Select, Space, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { http } from "@/shared/api/http";
import { DataTable, TopPagination } from "@/shared/components";
import type { ColumnWithSortType } from "@/shared/components";
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

const { RangePicker } = DatePicker;

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

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

  const columns: ColumnWithSortType<Raw> = [
    {
      title: "Ngày",
      dataIndex: "document_date",
      width: 115,
      sortType: "value",
      sorter: (a, b) =>
        new Date(text(a.document_date, "")).getTime() -
        new Date(text(b.document_date, "")).getTime(),
      render: (value) => formatDate(text(value, "")),
    },
    {
      title: "Phiếu",
      dataIndex: "outbound_no",
      width: 150,
      sorter: (a, b) =>
        text(a.outbound_no).localeCompare(text(b.outbound_no), "vi"),
    },
    {
      title: "Loại nơi nhận",
      dataIndex: "recipient_type",
      width: 150,
      sorter: (a, b) =>
        recipientTypeLabel(text(a.recipient_type, "")).localeCompare(
          recipientTypeLabel(text(b.recipient_type, "")),
          "vi",
        ),
      render: (value) => <Tag>{recipientTypeLabel(text(value, ""))}</Tag>,
    },
    {
      title: "Nơi nhận",
      dataIndex: "recipient_name",
      width: 210,
      sorter: (a, b) =>
        text(a.recipient_name).localeCompare(text(b.recipient_name), "vi"),
    },
    {
      title: "Thị trường",
      dataIndex: "market",
      width: 130,
      sorter: (a, b) => text(a.market).localeCompare(text(b.market), "vi"),
    },
    {
      title: "Khu vực",
      dataIndex: "region",
      width: 130,
      sorter: (a, b) => text(a.region).localeCompare(text(b.region), "vi"),
    },
    {
      title: "SKU",
      dataIndex: "product_code",
      width: 150,
      sorter: (a, b) =>
        text(a.product_code).localeCompare(text(b.product_code), "vi"),
    },
    {
      title: "Tên SKU",
      dataIndex: "product_name",
      width: 210,
      sorter: (a, b) =>
        text(a.product_name).localeCompare(text(b.product_name), "vi"),
    },
    {
      title: "SL xuất",
      dataIndex: "issued_qty",
      width: 100,
      align: "right",
      sortType: "value",
      sorter: (a, b) => number(a.issued_qty) - number(b.issued_qty),
      render: (value) => number(value).toLocaleString("vi-VN"),
    },
  ];

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <Card size="small">
        <Space wrap>
          <RangePicker
            value={period}
            format="DD/MM/YYYY"
            onChange={(value) => {
              if (value?.[0] && value?.[1]) {
                setPeriod([value[0], value[1]]);
                setPage(1);
              }
            }}
          />
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder="Loại nơi nhận"
            aria-label="Loại nơi nhận"
            value={recipientType}
            options={Object.entries(RECIPIENT_TYPE_LABELS).map(
              ([value, label]) => ({
                value,
                label,
              }),
            )}
            onChange={(value) => {
              setRecipientType(value as RecipientType | undefined);
              setRecipientId(undefined);
              setMarket(undefined);
              setRegion(undefined);
              setPage(1);
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 240 }}
            placeholder="Nơi nhận"
            aria-label="Nơi nhận"
            value={recipientId}
            options={recipientOptions}
            loading={recipientQuery.isLoading}
            onChange={(value) => {
              setRecipientId(value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="Thị trường"
            aria-label="Thị trường"
            value={market}
            options={marketOptions}
            onChange={(value) => {
              setMarket(value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="Khu vực"
            aria-label="Khu vực"
            value={region}
            options={regionOptions}
            onChange={(value) => {
              setRegion(value);
              setPage(1);
            }}
          />
          {/* Dùng Input của antd cho khớp các bộ lọc antd bên cạnh: <input>
              thuần không ăn theme, không có transition viền/focus như phần
              còn lại của thanh lọc. */}
          <Input
            style={{ width: 180 }}
            value={skuCode ?? ""}
            placeholder="Mã SKU"
            aria-label="Mã SKU"
            allowClear
            onChange={(event) => {
              setSkuCode(event.target.value);
              setPage(1);
            }}
          />
        </Space>
      </Card>

      <Space wrap>
        <Tag color="blue">
          Nơi nhận: {number(summary.total_recipients ?? summary.total_agencies)}
        </Tag>
        <Tag>Phiếu: {number(summary.total_documents)}</Tag>
        <Tag color="green">
          Tổng xuất: {number(summary.total_issued_qty).toLocaleString("vi-VN")}
        </Tag>
      </Space>

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
      <TopPagination
        total={number(pagination.total) || rows.length}
        current={number(pagination.current_page) || page}
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

      <DataTable<Raw>
        rowKey={(row) =>
          `${text(row.document_id, "")}-${text(row.sku_id, "")}-${text(row.recipient_id, "")}`
        }
        loading={reportQuery.isLoading || reportQuery.isFetching}
        columns={columns}
        dataSource={rows}
        rowSelection={{
          type: "checkbox",
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        locale={{
          emptyText: (
            <Empty description="Chưa có dữ liệu xuất theo bộ lọc hiện tại" />
          ),
        }}
        scroll={{ x: 1450 }}
        pagination={{
          current: number(pagination.current_page) || page,
          pageSize: perPage,
          total: number(pagination.total) || rows.length,
          // Ẩn thanh phân trang mặc định của antd ở chân bảng — đã có
          // TopPagination phía trên đảm nhiệm, tránh hiện 2 khu vực phân trang.
          // Vẫn giữ current/pageSize để cột STT tính đúng số thứ tự theo trang.
          position: [],
        }}
      />
    </Space>
  );
}

export default function Gd1ScopeReports() {
  return <RecipientReport />;
}

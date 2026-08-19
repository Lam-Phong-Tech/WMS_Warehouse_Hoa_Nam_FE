/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Progress, Table, Tag, type TablePaginationConfig } from "antd";
import { EyeOutlined, PlusOutlined, ScanOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useHasPermission } from "@/shared/components/permission";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { AlignedOutboundDetailModal } from "@/modules/outbound/components/AlignedOutboundDetailModal";
import { OutboundIntakeModal } from "@/modules/outbound/components/OutboundIntakeModal";
import {
  fetchOutboundDocuments,
  type OutboundDocumentRecord,
  type OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";

const SEARCH_DEBOUNCE_MS = 250;

const STATUS_OPTIONS: Array<{ value: OutboundStatus; label: string }> = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "SCANNING", label: "ĐANG QUÉT" },
  { value: "POSTED", label: "ĐÃ POST" },
  { value: "CANCELLED", label: "ĐÃ HỦY" },
];

const STATUS_COLOR: Record<OutboundStatus, string> = {
  DRAFT: "warning",
  SCANNING: "processing",
  POSTED: "success",
  CANCELLED: "error",
};

const STATUS_LABEL: Record<OutboundStatus, string> = {
  DRAFT: "DRAFT",
  SCANNING: "ĐANG QUÉT",
  POSTED: "ĐÃ POST",
  CANCELLED: "ĐÃ HỦY",
};

const DETAIL_SCREENS = new Set(["OUT-03", "OUT-02", "LBL-01", "RFID-01"]);

/** Canonical OUT-01 hub: scan -> 1 Packing Label/lot -> optional RFID -> Post Issue. */
export default function AlignedMvpOutboundPage() {
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OutboundStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const canImport = can("outbound.import");
  const canScan = can("outbound.scan");

  const listQuery = useQuery({
    queryKey: ["mvp-outbound", "list", search, status, page, perPage],
    queryFn: () =>
      fetchOutboundDocuments({
        search: search || undefined,
        status: status || undefined,
        page,
        per_page: perPage,
      }),
  });

  const rows = listQuery.data?.data ?? [];
  const pagination = resolveApiPagination(listQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "OUT-01") return;
    if (screen === "OUT-REQ-01") {
      setIntakeOpen(true);
    } else if (DETAIL_SCREENS.has(screen)) {
      const id = searchParams.get("id");
      if (id) setDetailId(id);
    } else {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("screen", "OUT-01");
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // WWHN-217 · D-217-02: Back của trình duyệt phải đóng overlay OUT-REQ-01/OUT-03 và
  // giữ người dùng ở OUT-01. Trước đây overlay chỉ là state React nên Back rời hẳn màn
  // xuất kho ngay giữa chuỗi scan -> Packing Label -> Post Issue.
  const overlayOpen = intakeOpen || detailId !== null;
  const closeOverlays = () => {
    setIntakeOpen(false);
    setDetailId(null);
  };
  useOverlayBackDismiss(overlayOpen, closeOverlays, "OUT-01-overlay");

  const columns: ColumnsType<OutboundDocumentRecord> = [
    {
      title: "Phiếu xuất",
      dataIndex: "code",
      key: "code",
      width: 190,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Request",
      dataIndex: "outboundRequestId",
      key: "request",
      width: 150,
      render: (value: string | null | undefined) =>
        value ? (
          <span title={value}>
            {value.length > 12 ? `${value.slice(0, 8)}…` : value}
          </span>
        ) : (
          <Tag color="error">Thiếu request</Tag>
        ),
    },
    {
      title: "Người nhận",
      dataIndex: "recipientName",
      key: "recipientName",
      width: 190,
    },
    {
      title: "Match",
      key: "match",
      width: 190,
      render: (_, row) => {
        const percent =
          row.expected > 0
            ? Math.min(100, Math.round((row.scanned / row.expected) * 100))
            : 0;
        return (
          <div style={{ minWidth: 150 }}>
            <Progress
              percent={percent}
              size="small"
              status={row.status === "POSTED" ? "success" : "normal"}
            />
            <span style={{ fontSize: 12 }}>
              {row.scanned} / {row.expected}
            </span>
          </div>
        );
      },
    },
    {
      title: "Packing Label",
      key: "label",
      width: 160,
      render: (_, row) => {
        const printed = row.labelPrintedCount ?? 0;
        return printed >= 1 ? (
          <Tag color="success">1/1 ĐÃ IN</Tag>
        ) : (
          <Tag
            color={
              row.scanned >= row.expected && row.expected > 0
                ? "warning"
                : "default"
            }
          >
            0/1
          </Tag>
        );
      },
    },
    {
      title: "RFID",
      key: "rfid",
      width: 150,
      render: (_, row) => (
        <Tag
          color={
            row.rfidMappedCount && row.rfidMappedCount > 0 ? "blue" : "default"
          }
        >
          Tùy chọn · {row.rfidMappedCount ?? 0}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: OutboundStatus) => (
        <Tag color={STATUS_COLOR[value]}>{STATUS_LABEL[value]}</Tag>
      ),
    },
    {
      title: "Cập nhật",
      key: "updatedAt",
      width: 170,
      render: (_, row) => row.updatedAt ?? row.date ?? "-",
    },
    {
      title: "Hành động",
      key: "actions",
      width: 130,
      fixed: "right",
      render: (_, row) => {
        const mutable = row.status === "DRAFT" || row.status === "SCANNING";
        return (
          <button
            className="btn small"
            type="button"
            onClick={() => setDetailId(row.id)}
          >
            {mutable && canScan ? (
              <ScanOutlined style={{ marginRight: 4 }} />
            ) : (
              <EyeOutlined style={{ marginRight: 4 }} />
            )}
            {mutable && canScan ? "Mở" : "Xem"}
          </button>
        );
      },
    },
  ];

  const refreshAll = () =>
    void queryClient.invalidateQueries({ queryKey: ["mvp-outbound"] });

  return (
    <div className="outbound-page">
      <div className="toolbar-wrap" style={{ gap: 6 }}>
        <span className="pill ok">
          Scan → tổng hợp → 1 Packing Label/lô → Post Issue
        </span>
        <span className="pill blue">RFID tùy chọn</span>
        <span className="pill warn-pill">Chỉ Post Issue mới trừ tồn</span>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          value={searchInput}
          placeholder="Tìm mã phiếu xuất / ghi chú..."
          aria-label="Tìm phiếu xuất"
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <select
          className="select"
          value={status}
          aria-label="Lọc trạng thái phiếu xuất"
          onChange={(event) => {
            setStatus(event.target.value as OutboundStatus | "");
            setPage(1);
          }}
        >
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        {canImport ? (
          <button
            className="btn primary"
            type="button"
            onClick={() => setIntakeOpen(true)}
          >
            <PlusOutlined /> Tiếp nhận yêu cầu xuất
          </button>
        ) : null}
      </div>

      {listQuery.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={listQuery.error}
            title="Không tải được danh sách phiếu xuất"
            onRetry={() => listQuery.refetch()}
          />
        </div>
      ) : null}

      <MvpPageSizeSelector
        value={perPage}
        onChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />

      <TableLoadingBanner
        loading={listQuery.isLoading || listQuery.isFetching}
      />
      <Table<OutboundDocumentRecord>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={listQuery.isLoading || listQuery.isFetching}
        onChange={(next: TablePaginationConfig) => setPage(next.current ?? 1)}
        pagination={{
          current: pagination.current,
          pageSize: perPage,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (count) => `Tổng ${count} phiếu xuất`,
        }}
        locale={{
          emptyText: tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Chưa có phiếu xuất phù hợp",
          ),
        }}
        scroll={{ x: 1390 }}
      />

      <div className="footer-note">
        Mở phiếu để thực hiện đúng thứ tự:{" "}
        <b>
          Scan đủ → tổng hợp lô → tạo/preview/in/dán đúng 01 Packing Label →
          RFID tùy chọn → Hoàn tất xuất
        </b>
        .
      </div>

      {intakeOpen ? (
        <OutboundIntakeModal
          open
          canImport={canImport}
          onClose={() => setIntakeOpen(false)}
          onConsumed={(documentIds) => {
            setIntakeOpen(false);
            refreshAll();
            if (documentIds[0]) setDetailId(documentIds[0]);
          }}
        />
      ) : null}

      {detailId ? (
        <AlignedOutboundDetailModal
          documentId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refreshAll}
        />
      ) : null}
    </div>
  );
}

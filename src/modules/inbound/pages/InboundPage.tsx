import { useEffect, useState } from "react";
import {
  Button,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  type TablePaginationConfig,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useSearchParams } from "react-router-dom";
import { ActionDropdown } from "@/shared/components/feedback/ActionDropdown";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import {
  INBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { useAuthStore } from "@/shared/store/auth.store";
import { InboundDraftModal } from "@/modules/inbound/components/InboundDraftModal";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type { InboundDocument } from "@/modules/inbound/types";

const STATUS_OPTIONS: Array<{
  label: string;
  value: InboundDocument["status"];
}> = Object.entries(INBOUND_STATUS_LABELS).map(([value, label]) => ({
  value: value as InboundDocument["status"],
  label,
}));

const PAGE_SIZE_OPTIONS = [15, 20, 50, 100];
const SEARCH_DEBOUNCE_MS = 250;

function statusTag(status: InboundDocument["status"]) {
  const color =
    status === "POSTED"
      ? "success"
      : status === "SCANNING"
        ? "processing"
        : status === "CANCELLED"
          ? "error"
          : "warning";
  return (
    <Tag color={color}>
      {businessLabel(INBOUND_STATUS_LABELS, status, "Chưa xác định")}
    </Tag>
  );
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function InboundListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);

  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const query = useInboundDocuments({
    search: search || undefined,
    status,
    page,
    per_page: perPage,
  });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const total = Number(meta?.total ?? rows.length);

  useEffect(() => {
    const requestedScreen = searchParams.get("screen");
    if (requestedScreen !== "IN-02" && requestedScreen !== "IN-03") return;

    const id = searchParams.get("id");
    if (requestedScreen === "IN-02") {
      setDraftDocumentId(id);
      setDraftOpen(true);
    } else if (id) {
      setScanDocumentId(id);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "IN-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const openCreateModal = () => {
    setDraftDocumentId(null);
    setDraftOpen(true);
  };

  const openEditModal = (documentId: string) => {
    setDraftDocumentId(documentId);
    setDraftOpen(true);
  };

  const closeDraftModal = () => {
    setDraftOpen(false);
    setDraftDocumentId(null);
  };

  const handleSaved = (documentId: string) => {
    closeDraftModal();
    setScanDocumentId(documentId);
  };

  const openExpectedCorrectionFromScan = (documentId: string) => {
    setScanDocumentId(null);
    openEditModal(documentId);
  };

  // WWHN-217 · D-217-01: Back của trình duyệt (và nút Back cứng/cử chỉ vuốt trên
  // Chrome Android — thiết bị bắt buộc theo NFR-SRS-006) phải đóng overlay IN-02/IN-03
  // và giữ người dùng ở IN-01, thay vì rời hẳn màn nhập kho giữa lúc đang quét dở.
  // Gộp mọi overlay của màn vào MỘT cờ để bước chuyển IN-02 -> IN-03 (lưu nháp rồi
  // sang scan) không sinh cặp push/pop chồng nhau trong cùng một commit.
  const overlayOpen = draftOpen || scanDocumentId !== null;
  const closeOverlays = () => {
    setDraftOpen(false);
    setDraftDocumentId(null);
    setScanDocumentId(null);
  };
  useOverlayBackDismiss(overlayOpen, closeOverlays, "IN-01-overlay");

  const columns: ColumnsType<InboundDocument> = [
    {
      title: "Phiếu nhập",
      dataIndex: "code",
      key: "code",
      width: 180,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Nguồn / tham chiếu",
      dataIndex: "source",
      key: "source",
      width: 220,
      render: (value: string) => value || "-",
    },
    {
      title: "Tiến độ quét",
      key: "progress",
      width: 220,
      render: (_, row) => {
        const percent =
          row.expected > 0
            ? Math.min(100, Math.round((row.scanned / row.expected) * 100))
            : 0;
        return (
          <div style={{ minWidth: 170 }}>
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
      title: "Trạng thái",
      dataIndex: "status",
      width: 170,
      render: statusTag,
    },
    {
      title: "Cập nhật",
      key: "updatedAt",
      width: 180,
      render: (_, row) => row.updatedAt ?? row.date ?? "-",
    },
    {
      title: "Hành động",
      key: "actions",
      width: 210,
      fixed: "right",
      render: (_, row) => {
        const mutable = row.status === "DRAFT" || row.status === "SCANNING";
        const primaryLabel =
          mutable && canScan
            ? row.status === "DRAFT"
              ? "Bắt đầu quét"
              : "Tiếp tục quét"
            : "Xem";

        return (
          <Space size={2}>
            <Button
              type="link"
              size="small"
              icon={mutable && canScan ? <ScanOutlined /> : <EyeOutlined />}
              onClick={() => setScanDocumentId(row.id)}
            >
              {primaryLabel}
            </Button>
            {canCreate && mutable ? (
              <ActionDropdown
                tooltip={
                  row.status === "SCANNING"
                    ? "Điều chỉnh số lượng dự kiến"
                    : "Sửa phiếu nháp"
                }
                icon={<EditOutlined />}
                items={[
                  {
                    key: "edit-inbound",
                    label:
                      row.status === "SCANNING"
                        ? "Điều chỉnh số lượng dự kiến"
                        : "Sửa phiếu",
                    icon: <EditOutlined />,
                    onClick: () => openEditModal(row.id),
                  },
                ]}
              />
            ) : null}
          </Space>
        );
      },
    },
  ];

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
  };

  return (
    <div className="inbound-page hn-mvp-source-screen">
      <div className="toolbar">
        <input
          className="input search"
          value={searchInput}
          placeholder="Tìm mã phiếu / nguồn nhập..."
          aria-label="Tìm phiếu nhập"
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <select
          className="select"
          value={status ?? ""}
          aria-label="Lọc trạng thái phiếu nhập"
          onChange={(event) => {
            setStatus(event.target.value || undefined);
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
        {canCreate ? (
          <button
            className="btn primary"
            type="button"
            onClick={openCreateModal}
          >
            <PlusOutlined /> Tạo phiếu nhập
          </button>
        ) : null}
      </div>

      {query.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={query.error}
            title="Không tải được danh sách phiếu nhập."
            onRetry={() => query.refetch()}
          />
        </div>
      ) : null}

      <div className="table-page-size">
        <Select
          size="small"
          value={perPage}
          style={{ width: 110 }}
          showSearch={false}
          labelRender={({ value }) => `${value} / trang`}
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            value: size,
            label: `${size} / trang`,
          }))}
          onChange={(nextPageSize) => {
            setPerPage(nextPageSize);
            setPage(1);
          }}
        />
      </div>

      <TableLoadingBanner loading={query.isLoading || query.isFetching} />
      <Table<InboundDocument>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={query.isLoading || query.isFetching}
        onChange={handleTableChange}
        pagination={{
          current: Number(meta?.current_page ?? page),
          pageSize: perPage,
          total,
          showSizeChanger: false,
          showTotal: (count) => `Tổng ${count} phiếu nhập`,
        }}
        locale={{
          emptyText: tableEmptyText(
            query.isError ? query.error : null,
            "Chưa có phiếu nhập phù hợp",
          ),
        }}
        scroll={{ x: "max-content" }}
      />

      {draftOpen ? (
        <InboundDraftModal
          documentId={draftDocumentId}
          onClose={closeDraftModal}
          onSaved={handleSaved}
        />
      ) : null}

      {scanDocumentId ? (
        <InboundScanModal
          documentId={scanDocumentId}
          onClose={() => setScanDocumentId(null)}
          onChanged={() => void query.refetch()}
          onEditExpected={() => openExpectedCorrectionFromScan(scanDocumentId)}
        />
      ) : null}
    </div>
  );
}

export default function InboundPage() {
  return <InboundListScreen />;
}

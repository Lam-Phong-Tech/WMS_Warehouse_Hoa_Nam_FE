import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  type TablePaginationConfig,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useSearchParams } from "react-router-dom";
import {
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
import { ActionDropdown } from "@/shared/components/feedback/ActionDropdown";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { InboundDraftModal } from "@/modules/inbound/components/InboundDraftModal";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type { InboundDocument } from "@/modules/inbound/types";

const STATUS_OPTIONS = [
  { label: "DRAFT", value: "DRAFT" },
  { label: "SCANNING", value: "SCANNING" },
  { label: "POSTED", value: "POSTED" },
  { label: "CANCELLED", value: "CANCELLED" },
];

const PAGE_SIZE_OPTIONS = [15, 20, 50, 100];

function statusTag(status: InboundDocument["status"]) {
  const color =
    status === "POSTED"
      ? "success"
      : status === "SCANNING"
        ? "processing"
        : status === "CANCELLED"
          ? "error"
          : "warning";
  return <Tag color={color}>{status}</Tag>;
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function ApiErrorAlert({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return (
    <Alert
      showIcon
      type={normalized.status === 403 ? "warning" : "error"}
      message={
        normalized.status === 403
          ? "Không có quyền truy cập"
          : getApiErrorMessage(error, fallback)
      }
      description={[
        normalized.status ? `HTTP ${normalized.status}` : undefined,
        normalized.code ? `Mã lỗi: ${normalized.code}` : undefined,
        requestId ? `Mã yêu cầu: ${requestId}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ")}
    />
  );
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

  const applySearch = (value: string) => {
    const normalized = value.trim();
    setSearchInput(value);
    setSearch(normalized);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus(undefined);
    setPage(1);
  };

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
      title: "Tiến độ scan",
      key: "progress",
      width: 220,
      render: (_, row) => {
        const percent =
          row.expected > 0
            ? Math.min(
                100,
                Math.round((row.scanned / row.expected) * 100),
              )
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
      width: 130,
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
      width: 190,
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
                    ? "Hiệu chỉnh Expected"
                    : "Sửa phiếu DRAFT"
                }
                icon={<EditOutlined />}
                items={[
                  {
                    key: "edit-inbound",
                    label:
                      row.status === "SCANNING"
                        ? "Hiệu chỉnh Expected"
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
    <div className="inbound-page master-data-page">
      <div className="page-heading">
        <div>
          <h1>Danh sách phiếu nhập</h1>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canCreate}
            title={canCreate ? undefined : "Bạn không có quyền tạo phiếu nhập"}
            onClick={openCreateModal}
          >
            Tạo phiếu nhập
          </Button>
        </Space>
      </div>

      <Card className="master-data-panel">
        <div className="master-data-contract-strip">
          <Tag color="blue">GET /inbound-documents</Tag>
          <Tag color="gold">inbound.view / create / scan / post</Tag>
          <Tag>Full-post only</Tag>
        </div>

        <Row gutter={[12, 12]} className="filter-row">
          <Col xs={24} md={8}>
            <Input.Search
              allowClear
              value={searchInput}
              placeholder="Tìm mã phiếu / nguồn nhập..."
              onSearch={applySearch}
              onChange={(event) => {
                const value = event.target.value;
                setSearchInput(value);
                if (!value) {
                  setSearch("");
                  setPage(1);
                }
              }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              allowClear
              className="full-width"
              placeholder="Trạng thái"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Button className="full-width" onClick={resetFilters}>
              Xóa lọc
            </Button>
          </Col>
          <Col xs={24} md={4} className="panel-extra-actions">
            <Button
              icon={<ReloadOutlined />}
              className="full-width"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Làm mới
            </Button>
          </Col>
        </Row>

        <Alert
          showIcon
          type="info"
          className="master-data-state-alert"
          message="Luồng chuẩn: DRAFT → SCANNING → Full Post Receipt → POSTED"
          description="DRAFT/SCANNING và mọi scan đều stock-neutral. Chỉ Full Post khi mọi dòng đủ chính xác; COMPONENT sau Post mới đi Putaway và Putaway không đổi tồn."
        />

        {query.isError ? (
          <ApiErrorAlert
            error={query.error}
            fallback="Không tải được danh sách phiếu nhập."
          />
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
            emptyText: query.isError
              ? "Không tải được dữ liệu"
              : "Chưa có phiếu nhập phù hợp",
          }}
          scroll={{ x: 1080 }}
        />
      </Card>

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
          onEditExpected={() =>
            openExpectedCorrectionFromScan(scanDocumentId)
          }
        />
      ) : null}
    </div>
  );
}

export default function InboundPage() {
  return <InboundListScreen />;
}

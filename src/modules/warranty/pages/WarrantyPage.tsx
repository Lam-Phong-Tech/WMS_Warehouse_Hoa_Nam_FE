/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState, type Key } from "react";
import { useSearchParams } from "react-router-dom";
import { Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  CameraOutlined,
  EyeOutlined,
  PlusOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { useHasPermission } from "@/shared/components/permission";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import {
  WARRANTY_BASELINE_STATUSES,
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  formatWarrantyDateTime,
  warrantyPiiText,
} from "@/modules/warranty/constants";
import {
  useWarrantyCases,
  warrantyKeys,
} from "@/modules/warranty/hooks/use-warranty";
import { ComponentIssueModal } from "@/modules/warranty/components/ComponentIssueModal";
import { WarrantyDetailModal } from "@/modules/warranty/components/WarrantyDetailModal";
import { WarrantyIntakeModal } from "@/modules/warranty/components/WarrantyIntakeModal";
import type {
  WarrantyCase,
  WarrantyCaseStatus,
  WarrantyIdentificationType,
} from "@/modules/warranty/types";

const SEARCH_DEBOUNCE_MS = 250;
const DETAIL_SCREENS = new Set(["WAR-03"]);

interface ComponentIssueTarget {
  caseId: string;
  caseCode?: string;
  caseActive: boolean;
  documentId?: string | null;
}

function machineDisplay(record: WarrantyCase): string {
  if (record.identification_type === "TEMP_ONLY") {
    return (
      record.temporary_item_code ?? record.manual_product_description ?? "—"
    );
  }
  return (
    record.item_code ?? record.serial_number ?? record.physical_code ?? "—"
  );
}

function caseAgeDays(record: WarrantyCase): number | undefined {
  if (typeof record.case_age_days === "number") return record.case_age_days;
  const received = new Date(record.received_at).getTime();
  if (!Number.isFinite(received)) return undefined;
  return Math.max(0, Math.floor((Date.now() - received) / 86_400_000));
}

/**
 * WAR-01 · Danh sách bảo hành — màn hub của luồng 04 · Bảo hành & linh kiện.
 * Tiếp nhận (WAR-02), Chi tiết (WAR-03) và Xuất linh kiện (COMP-01) đều mở
 * modal ngay trên danh sách, không chuyển trang — đồng bộ pattern luồng 02/03.
 */
export default function WarrantyPage() {
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState<WarrantyCaseStatus | "">("");
  const [identification, setIdentification] = useState<
    WarrantyIdentificationType | ""
  >("");
  const [defectId, setDefectId] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [componentTarget, setComponentTarget] =
    useState<ComponentIssueTarget | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const canManage = can("warranty.manage");
  const canViewPii = can("warranty.pii.view");

  const listQuery = useWarrantyCases({
    search: search || undefined,
    status: status || undefined,
    identification_status: identification || undefined,
    defect_id: defectId || undefined,
    page,
    per_page: perPage,
  });
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });

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

  // Bỏ chọn dòng khi trang/bộ lọc đổi — lựa chọn của trang trước không còn áp dụng.
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, perPage, search, status, identification, defectId]);

  // Deep-link các màn wireframe: ?screen=WAR-02 mở tiếp nhận, ?screen=WAR-03&id=...
  // mở chi tiết, ?screen=COMP-01&id=<caseId> mở xuất linh kiện. URL trở về WAR-01.
  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "WAR-01") return;
    if (screen === "WAR-02") {
      setIntakeOpen(true);
    } else if (DETAIL_SCREENS.has(screen)) {
      const id = searchParams.get("id");
      if (id) setDetailId(id);
    } else if (screen === "COMP-01") {
      const id = searchParams.get("id");
      if (id) {
        setComponentTarget({ caseId: id, caseActive: true, documentId: null });
      } else {
        message.info(
          "Chọn một case bảo hành trong danh sách rồi bấm “Xuất linh kiện”.",
        );
      }
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "WAR-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
  };

  const columns: ColumnsType<WarrantyCase> = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      fixed: "left",
      render: (_, __, index) => mvpRowNumber(page, perPage, index),
    },
    {
      title: "Case",
      dataIndex: "case_code",
      key: "case_code",
      width: 190,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Nhận diện",
      key: "identification",
      width: 200,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Tag
            color={row.identification_type === "TEMP_ONLY" ? "warning" : "blue"}
          >
            {row.identification_type}
          </Tag>
          <Typography.Text style={{ fontSize: 12 }}>
            {machineDisplay(row)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      width: 190,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
          <Typography.Text>
            {warrantyPiiText(row.customer_name, canViewPii, "name") || "—"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {warrantyPiiText(row.customer_phone, canViewPii, "phone") || "—"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Sản phẩm",
      key: "sku",
      width: 170,
      render: (_, row) =>
        row.identification_type === "TEMP_ONLY" && !row.sku
          ? "Mô tả thủ công"
          : row.sku || row.sku_name || "—",
    },
    {
      title: "Bệnh / lỗi",
      key: "defect",
      width: 220,
      render: (_, row) =>
        row.defects?.length ? (
          <Space wrap size={4}>
            {row.defects.map((defect) => (
              <Tag
                key={defect.defect_id}
                color={defect.is_primary ? "blue" : undefined}
              >
                {defect.defect_name || defect.defect_code}
              </Tag>
            ))}
          </Space>
        ) : row.defect !== "-" && row.defect ? (
          row.defect
        ) : (
          (row.reported_defect ?? row.defect_code ?? "—")
        ),
    },
    {
      title: "Ngày nhận",
      dataIndex: "received_at",
      key: "received_at",
      width: 150,
      render: (value: string) => formatWarrantyDateTime(value),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (value: WarrantyCaseStatus) => (
        <Tag color={WARRANTY_STATUS_COLORS[value]}>
          {WARRANTY_STATUS_LABELS[value] ?? value}
        </Tag>
      ),
    },
    {
      title: "Tuổi case",
      key: "age",
      width: 100,
      align: "right",
      render: (_, row) => {
        const age = caseAgeDays(row);
        return age === undefined ? "—" : `${age} ngày`;
      },
    },
    {
      title: "",
      key: "actions",
      width: 90,
      fixed: "right",
      render: (_, row) => (
        <button
          className="btn small"
          type="button"
          onClick={() => setDetailId(row.id)}
        >
          <EyeOutlined style={{ marginRight: 4 }} />
          Mở
        </button>
      ),
    },
  ];

  const handleTableChange = (nextPagination: TablePaginationConfig) => {
    setPage(nextPagination.current ?? 1);
  };

  return (
    <div className="warranty-page hn-mvp-source-screen">
     

      {!canViewPii ? (
        <div className="footer-note" style={{ marginBottom: 8 }}>
          <ToolOutlined style={{ marginRight: 6 }} />
          Thông tin khách hàng (tên/SĐT/địa chỉ) đang được che theo quyền{" "}
          <b>warranty.pii.view</b>.
        </div>
      ) : null}

      <div className="toolbar">
        {/* Annex D SCR-WAR-01 scan-focus: auto-focus ô quét, Enter/đầu đọc submit ngay
            (không chờ debounce) và giữ focus sau khi tìm. §5.3 liệt kê camera là context
            hợp lệ cho cả "warranty receive/search" nên WAR-01 có nút camera fallback. */}
        <input
          ref={searchRef}
          className="input search"
          value={searchInput}
          autoFocus
          placeholder="Quét hoặc nhập case / mã máy / mã tạm / SĐT..."
          aria-label="Tìm case bảo hành"
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
            searchRef.current?.focus();
          }}
        />
        <button
          className="btn"
          type="button"
          aria-label="Quét mã máy bằng camera"
          onClick={() => setCameraOpen(true)}
        >
          <CameraOutlined /> Camera
        </button>
        <select
          className="select"
          value={status}
          aria-label="Lọc trạng thái bảo hành"
          onChange={(event) => {
            setStatus(event.target.value as WarrantyCaseStatus | "");
            setPage(1);
          }}
        >
          <option value="">Trạng thái: Tất cả</option>
          {WARRANTY_BASELINE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {WARRANTY_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={identification}
          aria-label="Lọc loại nhận diện"
          onChange={(event) => {
            setIdentification(
              event.target.value as WarrantyIdentificationType | "",
            );
            setPage(1);
          }}
        >
          <option value="">Nhận diện: Tất cả</option>
          <option value="IDENTIFIED">IDENTIFIED</option>
          <option value="TEMP_ONLY">TEMP_ONLY</option>
        </select>
        <select
          className="select"
          value={defectId}
          aria-label="Lọc bệnh/lỗi"
          onChange={(event) => {
            setDefectId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Bệnh/lỗi: Tất cả</option>
          {(defectsQuery.data?.data ?? []).map((defect) => (
            <option key={defect.defect_id} value={defect.defect_id}>
              {defect.defect_code} · {defect.defect_name}
            </option>
          ))}
        </select>
        <MvpPageSizeSelector
          value={perPage}
          onChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
        <div className="spacer" />
        {canManage ? (
          <button
            className="btn primary"
            type="button"
            onClick={() => setIntakeOpen(true)}
          >
            <PlusOutlined /> Tiếp nhận bảo hành
          </button>
        ) : null}
      </div>

      {listQuery.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={listQuery.error}
            title="Không tải được danh sách bảo hành"
            onRetry={() => listQuery.refetch()}
          />
        </div>
      ) : null}

      <TableLoadingBanner
        loading={listQuery.isLoading || listQuery.isFetching}
      />
      <Table<WarrantyCase>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={listQuery.isLoading || listQuery.isFetching}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          type: "checkbox",
        }}
        onChange={handleTableChange}
        pagination={{
          current: pagination.current,
          pageSize: perPage,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (count) => `Tổng ${count} case bảo hành`,
        }}
        locale={{
          emptyText: tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Không có case bảo hành theo bộ lọc hiện tại",
          ),
        }}
        onRow={(row) => ({ onDoubleClick: () => setDetailId(row.id) })}
        scroll={{ x: "max-content" }}
      />
      {intakeOpen ? (
        <WarrantyIntakeModal
          open
          onClose={() => setIntakeOpen(false)}
          onCreated={(created) => {
            setIntakeOpen(false);
            refreshAll();
            setDetailId(created.id);
          }}
        />
      ) : null}

      {detailId ? (
        <WarrantyDetailModal
          caseId={detailId}
          onClose={() => setDetailId(null)}
          onOpenComponentIssue={(target) => setComponentTarget(target)}
        />
      ) : null}

      <CameraScanModal
        open={cameraOpen}
        title="Quét mã máy / mã tạm để tra cứu case"
        onDetected={(code) => {
          setSearchInput(code.trim());
          setSearch(code.trim());
          setPage(1);
          setCameraOpen(false);
        }}
        onClose={() => setCameraOpen(false)}
      />

      {componentTarget ? (
        <ComponentIssueModal
          caseId={componentTarget.caseId}
          caseCode={componentTarget.caseCode}
          caseActive={componentTarget.caseActive}
          documentId={componentTarget.documentId}
          onClose={() => setComponentTarget(null)}
          onChanged={refreshAll}
        />
      ) : null}
    </div>
  );
}

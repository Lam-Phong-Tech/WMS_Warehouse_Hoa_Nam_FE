/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Table, Tag, Typography } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useHasPermission } from "@/shared/components/permission";
import { useReversalDocuments, reversalKeys } from "../hooks/use-reversal";
import { ReversalCreateModal } from "../components/ReversalCreateModal";
import { ReversalDetailModal } from "../components/ReversalDetailModal";
import { ReversalStatusTag } from "../components/ReversalStatusTag";
import type { ReversalDocument } from "../types";

const SEARCH_DEBOUNCE_MS = 250;

const numberFormatter = new Intl.NumberFormat("vi-VN");

/**
 * REV-00 · Danh sách phiếu Reversal — màn hub cho hoàn đảo.
 * Tạo Reversal (REV-01) và Chi tiết đều mở modal ngay trên danh sách,
 * không chuyển trang — đồng bộ pattern luồng 02/03/04.
 */
export default function ReversalPage() {
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const canPost = can("inventory.reversal.post");

  const listQuery = useReversalDocuments({
    keyword: search || undefined,
    status: statusFilter || undefined,
    page,
    per_page: perPage,
  });
  const rows = listQuery.data?.rows ?? [];
  const listMeta = listQuery.data?.meta;
  const listPagination = resolveApiPagination(listMeta, {
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
    if (!screen || screen === "REV-00") return;
    if (screen === "REV-01") {
      setCreateOpen(true);
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "REV-00");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: reversalKeys.all });
  };

  const columns: ColumnsType<ReversalDocument> = [
    {
      title: "Mã hoàn đảo",
      dataIndex: "reversal_code",
      key: "reversal_code",
      width: 160,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Chứng từ gốc",
      key: "ref",
      width: 180,
      render: (_, row) => (
        <Typography.Text code>
          {row.reference_document_code || row.reference_document_id}
        </Typography.Text>
      ),
    },
    {
      title: "Loại chứng từ gốc",
      key: "reference_document_type",
      width: 170,
      render: (_, row) => <Tag>{row.reference_document_type || "-"}</Tag>,
    },
    {
      title: "Kho",
      dataIndex: "warehouse_name",
      key: "warehouse",
      width: 140,
    },
    {
      title: "Tổng SL",
      dataIndex: "total_qty",
      key: "total_qty",
      width: 100,
      align: "right",
      render: (value: number) => numberFormatter.format(value),
    },
    {
      title: "Lý do",
      dataIndex: "reason",
      key: "reason",
      width: 220,
      ellipsis: true,
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 190,
      render: (_, row) => (
        <ReversalStatusTag
          status={row.status}
          physicalReturnStatus={row.physical_return_status}
          compact
        />
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
    },
    {
      title: "Người tạo",
      dataIndex: "created_by",
      key: "created_by",
      width: 130,
    },
    {
      title: "",
      key: "actions",
      width: 80,
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
    <div className="reversal-page">
      <div className="toolbar-wrap" style={{ gap: 6 }}>
        <span className="pill blue">GET /reversal-documents</span>
        <span className="pill blue">POST /reversal-documents</span>
        <span className="pill blue">GET /stock-movements/reversible</span>
        <span className="pill warn-pill">Idempotency-Key · If-Match</span>
        <span className="pill ok">
          Append-only · Movement gốc bất biến · Dependency guard
        </span>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          value={searchInput}
          placeholder="Mã hoàn đảo, chứng từ gốc, lý do..."
          aria-label="Tìm phiếu hoàn đảo"
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="select"
          value={statusFilter}
          aria-label="Lọc trạng thái hoàn đảo"
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Trạng thái: Tất cả</option>
          <option value="DRAFT">DRAFT</option>
          <option value="POSTED">POSTED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <div className="spacer" />
        {canPost ? (
          <button
            className="btn primary"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <PlusOutlined /> Tạo hoàn đảo
          </button>
        ) : null}
      </div>

      {listQuery.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={listQuery.error}
            title="Không tải được danh sách hoàn đảo"
            onRetry={() => listQuery.refetch()}
          />
        </div>
      ) : null}

      <MvpPageSizeSelector
        value={perPage}
        onChange={(v) => {
          setPerPage(v);
          setPage(1);
        }}
      />

      <TableLoadingBanner
        loading={listQuery.isLoading || listQuery.isFetching}
      />
      <Table<ReversalDocument>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={listQuery.isLoading || listQuery.isFetching}
        onChange={handleTableChange}
        pagination={{
          current: listPagination.current,
          pageSize: listPagination.pageSize,
          total: listPagination.total,
          showSizeChanger: false,
          showTotal: (total) =>
            `Tổng ${new Intl.NumberFormat("vi-VN").format(total)} phiếu hoàn đảo`,
        }}
        locale={{
          emptyText: tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Không có phiếu hoàn đảo theo bộ lọc hiện tại",
          ),
        }}
        onRow={(row) => ({ onDoubleClick: () => setDetailId(row.id) })}
        scroll={{ x: 1400 }}
      />

      <div className="footer-note">
        Bấm <b>Mở</b> sẽ hiện modal chi tiết hoàn đảo (thông tin chứng từ &amp;
        dòng hoàn đảo) ngay trên danh sách — không chuyển trang. Bấm{" "}
        <b>+ Tạo hoàn đảo</b> để lookup movement và tạo reversal mới.
      </div>

      {/* ──── Modals ──── */}
      {createOpen ? (
        <ReversalCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            refreshAll();
          }}
        />
      ) : null}

      {detailId ? (
        <ReversalDetailModal
          documentId={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}
